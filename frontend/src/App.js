// FILE: src/App.js (VERSION 12.0 - FINAL MANUAL ENGINE)

import React, { useState } from 'react';
import './App.css';

function App() {
    const [productName, setProductName] = useState('');
    const [productUrl, setProductUrl] = useState('');
    const [mood, setMood] = useState('Energetic');
    const [language, setLanguage] = useState('English');
    // New simplified audio options
    const [audioOption, setAudioOption] = useState('voice-and-music');

    const [videoUrl, setVideoUrl] = useState('');
    const [script, setScript] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGenerateClick = async (event) => {
        event.preventDefault();
        if (!productName && !productUrl) {
            alert('Please provide a Product Name or a Product URL!');
            return;
        }

        setLoading(true);
        setVideoUrl('');
        setScript('');
        setError('');

        try {
            const response = await fetch('http://localhost:3001/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productName, productUrl, mood, language, audioOption }),
            });

            const data = await response.json();
            if (response.ok) {
                setVideoUrl(data.videoUrl);
                setScript(data.script);
            } else {
                setError(data.message || 'An error occurred.');
            }
        } catch (err) {
            setError('Failed to connect to the server. Is it running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="App">
            <div className="container">
                <header className="header-section">
                    <h1>🎬 AI TikTok Video Engine</h1>
                    <p>The core engine for your automated video factory.</p>
                </header>

                <form className="form-container" onSubmit={handleGenerateClick}>
                    <label htmlFor="productName">Product Name:</label>
                    <input id="productName" type="text" className="input-field" placeholder="e.g., 'Magic Glow Serum'" value={productName} onChange={(e) => setProductName(e.target.value)} />
                    
                    <p className="or-text">- OR -</p>
                    
                    <label htmlFor="productUrl">Product URL:</label>
                    <input id="productUrl" type="text" className="input-field" placeholder="e.g., Shopify or Amazon link" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} />

                    <div className="options-grid">
                        <div>
                            <label htmlFor="mood">Video Mood:</label>
                            <select id="mood" value={mood} onChange={(e) => setMood(e.target.value)} className="select-field">
                                <option value="Energetic">✨ Energetic & Fun</option>
                                <option value="Funny">😂 Funny</option>
                                <option value="Inspirational">💖 Inspirational</option>
                                <option value="Calm">🧘‍♀️ Calm & Aesthetic</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="language">Voice Language:</label>
                            <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)} className="select-field">
                                <option value="English">English</option>
                                <option value="Indonesian">Indonesian</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="audio-options-container">
                        <label htmlFor="audioOption">Audio Choice:</label>
                        <select id="audioOption" value={audioOption} onChange={(e) => setAudioOption(e.target.value)} className="select-field">
                            <option value="voice-and-music">AI Voice + Music</option>
                            <option value="voice-only">AI Voice Only</option>
                            <option value="music-only">Music Only</option>
                        </select>
                    </div>

                    <button type="submit" className="generate-button" disabled={loading}>
                        {loading ? '⚙️ Building Video...' : '✨ Generate Video'}
                    </button>
                </form>

                {error && <div className="error-message">{error}</div>}

                {videoUrl && (
                    <div className="results-container">
                        <h2>🎥 Generated Video:</h2>
                        <video controls width="100%" autoPlay key={videoUrl}><source src={videoUrl} type="video/mp4" /></video>
                        <a href={videoUrl} download={`tiktok-video-${Date.now()}.mp4`} className="download-button">⬇️ Download Video</a>
                        <h2>📝 Generated Script:</h2>
                        <pre className="script-box">{script}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;