use axum::{
    extract::Multipart,
    http::Method,
    response::Json,
    routing::post,
    Router,
};
use base64::{engine::general_purpose, Engine as _};
use dotenv::dotenv;
use reqwest::Client;
use serde::Serialize;
use std::env;
use tower_http::cors::{Any, CorsLayer};

  

#[derive(Serialize)]
struct LLMResponse {
    text: String,
    audio_b64: String,
}

#[tokio::main]
async fn main() {
    dotenv().ok();
let cors = CorsLayer::new()
    .allow_origin(Any)       // or specific domain
    .allow_methods([Method::POST, Method::OPTIONS])
    .allow_headers(Any);

let app = Router::new()
    .route("/ask", post(handle_audio))
    .layer(cors);

    println!("Server running on http://localhost:8000");


let port: u16 = env::var("PORT")
    .unwrap_or_else(|_| "8000".to_string())
    .parse()
    .expect("PORT must be a number");

axum::Server::bind(&format!("0.0.0.0:{}", port).parse().unwrap())
    .serve(app.into_make_service())
    .await
    .unwrap();

println!("Server running on port {}", port);
}

async fn handle_audio(mut multipart: Multipart) -> Json<LLMResponse> {
    let mut audio_bytes = Vec::new();
    let mut filename = String::from("audio.webm");

    while let Some(field) = multipart.next_field().await.unwrap() {
        if let Some(name) = field.file_name() {
            filename = name.to_string();
        }
        let data = field.bytes().await.unwrap();
        audio_bytes.extend_from_slice(&data);
    }

    println!("Received audio: {} bytes, filename: {}", audio_bytes.len(), filename);

    if audio_bytes.len() < 1000 {
        println!("Audio too small, skipping");
        return Json(LLMResponse { text: String::new(), audio_b64: String::new() });
    }

    let groq_key = env::var("GROQ_API_KEY").expect("GROQ_API_KEY not set");
    let client = Client::new();

    // ── 1. Groq Whisper STT ───────────────────────────────────────────────
    let mime = if filename.ends_with(".ogg") { "audio/ogg" }
               else if filename.ends_with(".mp4") { "audio/mp4" }
               else { "audio/webm" };

    let part = reqwest::multipart::Part::bytes(audio_bytes)
        .file_name(filename.clone())
        .mime_str(mime)
        .unwrap();

    let form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", "whisper-large-v3-turbo")
        .text("language", "en")
        .text("response_format", "json");

    let whisper_json = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", groq_key))
        .multipart(form)
        .send().await.unwrap()
        .json::<serde_json::Value>().await.unwrap();

    let user_text = whisper_json["text"].as_str().unwrap_or("").trim().to_string();
    if user_text.is_empty() {
        println!("No speech detected");
        return Json(LLMResponse { text: String::new(), audio_b64: String::new() });
    }
    println!("User said: {}", user_text);

    // ── 2. Groq LLaMA ─────────────────────────────────────────────────────
    let llm_json = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", groq_key))
        .json(&serde_json::json!({
            "model": "llama-3.1-8b-instant",
            "messages": [
                { "role": "system", "content": "You are Nova, a warm friendly AI assistant. Reply in 1-2 sentences max. Be natural." },
                { "role": "user",   "content": user_text }
            ],
            "temperature": 0.7,
            "max_tokens": 100
        }))
        .send().await.unwrap()
        .json::<serde_json::Value>().await.unwrap();

    let llm_text = llm_json["choices"][0]["message"]["content"]
        .as_str().unwrap_or("").trim().to_string();
    println!("AI reply: {}", llm_text);

    // ── 3. TTS — try ElevenLabs free tier first, fall back gracefully ─────
    // ElevenLabs free: 10,000 chars/month — get key at https://elevenlabs.io
    // Voice: "Rachel" (21m00Tcm4TlvDq8ikWAM) — natural female
    let audio_b64 = if let Ok(el_key) = env::var("ELEVENLABS_API_KEY") {
        let tts_resp = client
            .post("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM")
            .header("xi-api-key", el_key)
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "text": llm_text,
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.85,
                    "style": 0.2,
                    "use_speaker_boost": true
                }
            }))
            .send().await;

        match tts_resp {
            Ok(resp) if resp.status().is_success() => {
                let bytes = resp.bytes().await.unwrap_or_default();
                println!("ElevenLabs TTS: {} bytes", bytes.len());
                general_purpose::STANDARD.encode(&bytes)
            }
            Ok(resp) => {
                println!("ElevenLabs error: {}", resp.status());
                String::new()
            }
            Err(e) => {
                println!("ElevenLabs request failed: {}", e);
                String::new()
            }
        }
    } else {
        println!("No ELEVENLABS_API_KEY — frontend will use browser TTS");
        String::new()
    };

    Json(LLMResponse { text: llm_text, audio_b64 })
}