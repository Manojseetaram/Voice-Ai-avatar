use axum::{
    extract::Multipart,
    response::Json,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use std::env;
use reqwest::Client;

#[derive(Serialize)]
struct LLMResponse {
    text: String,
    audio_url: String,
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/ask", post(handle_audio));

    println!("Server running on http://localhost:8000");
    axum::Server::bind(&"0.0.0.0:8000".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn handle_audio(mut multipart: Multipart) -> Json<LLMResponse> {
    // 1️⃣ Extract audio file from multipart
    let mut audio_bytes = Vec::new();
    while let Some(field) = multipart.next_field().await.unwrap() {
        let data = field.bytes().await.unwrap();
        audio_bytes.extend_from_slice(&data);
    }

    // 2️⃣ Send audio to Whisper API (speech-to-text)
    let api_key = env::var("OPENAI_API_KEY").unwrap();
    let client = Client::new();

    let form = reqwest::multipart::Form::new()
        .part("file", reqwest::multipart::Part::bytes(audio_bytes).file_name("audio.wav"))
        .text("model", "whisper-1");

    let resp = client.post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .unwrap()
        .json::<serde_json::Value>()
        .await
        .unwrap();

    let user_text = resp["text"].as_str().unwrap_or("").to_string();

    // 3️⃣ Send text to LLM
    let llm_resp = client.post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": "gpt-4o-mini",
            "messages": [{"role":"user","content": user_text}],
            "temperature":0.7
        }))
        .send()
        .await
        .unwrap()
        .json::<serde_json::Value>()
        .await
        .unwrap();

    let llm_text = llm_resp["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string();

    // 4️⃣ Convert text to audio (TTS)
    let tts_resp = client.post("https://api.openai.com/v1/audio/speech")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": "gpt-4o-mini-tts",
            "voice": "alloy",
            "input": llm_text
        }))
        .send()
        .await
        .unwrap()
        .bytes()
        .await
        .unwrap();

    // Save to temp file (or return as base64)
    let filename = format!("/tmp/{}.mp3", uuid::Uuid::new_v4());
    tokio::fs::write(&filename, &tts_resp).await.unwrap();

    Json(LLMResponse {
        text: llm_text,
        audio_url: filename, // frontend can fetch this
    })
}