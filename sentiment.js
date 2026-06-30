document.addEventListener('DOMContentLoaded', () => {
    renderHistory();
});

document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const text = document.getElementById('reflectionInput').value.trim();
    if (!text) return;
    
    const btn = document.getElementById('analyzeBtn');
    btn.innerHTML = '<div class="spinner" style="width:24px;height:24px;border-width:3px;margin:auto;"></div>';
    btn.disabled = true;
    
    try {
        await analyzeSentiment(text);
    } catch (e) {
        console.error(e);
        const section = document.getElementById('interventionSection');
        const content = document.getElementById('interventionContent');
        section.classList.remove('hidden');
        content.innerHTML = `<p style="color: var(--error);">Analysis failed. Please check console or try again later.</p>`;
    }
    
    btn.innerHTML = '<span class="btn-text">Submit Journal & Analyze</span><svg class="sparkle" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><path d="M3 12h18"></path><path d="M19 5l-14 14"></path><path d="M5 5l14 14"></path></svg>';
    btn.disabled = false;
});

async function analyzeSentiment(text) {
    const prompt = `
You are an AI study coach analyzing a student's reflection journal entry.

Student Reflection: "${text}"

Your job is to do TWO things:
1. Categorize the student's emotional state into EXACTLY ONE of the following four categories: Stressed, Distracted, Motivated, or Engaged. Analyze the underlying emotion based on their entry.
2. Write a short, personalized 2-3 sentence insight and action plan explaining how they can adapt their study strategy right now to align with this state (e.g., suggesting a 15-minute gentle focus block for stress, or pushing for a deep 90-minute session if motivated).

Reply STRICTLY in valid JSON format like this, do not use markdown blocks, just the JSON:
{
  "state": "Engaged",
  "actionPlan": "Your personalized sentence here."
}
`;

    let modelToUse = localStorage.getItem('cached_gemini_model') || 'models/gemini-1.5-flash';
    let response = await fetch(`/api/generateContent?model=${encodeURIComponent(modelToUse)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 }
        })
    });

    // If 404, try to auto-discover a working model
    if (response.status === 404) {
        console.log("Model not found. Auto-discovering available models...");
        const modelsRes = await fetch(`/api/models`);
        if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            const availableModels = modelsData.models || [];
            const validModel = availableModels.find(m => 
                m.supportedGenerationMethods && 
                m.supportedGenerationMethods.includes('generateContent') && 
                m.name.includes('gemini')
            );
            if (validModel) {
                modelToUse = validModel.name;
                localStorage.setItem('cached_gemini_model', modelToUse);
                console.log("Retrying with model:", modelToUse);
                response = await fetch(`/api/generateContent?model=${encodeURIComponent(modelToUse)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1 }
                    })
                });
            }
        }
    }

    if (!response.ok) {
        const errText = await response.text();
        console.error("API Error Response:", errText);
        throw new Error(`Failed to reach AI: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const aiText = data.candidates[0].content.parts[0].text.trim();
    
    // Remove markdown formatting if the AI wraps it in json blocks
    const cleanJson = aiText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const parsed = JSON.parse(cleanJson);
    
    let state = parsed.state || "Engaged"; 
    let actionPlan = parsed.actionPlan || "Keep up the good work!";

    applyIntervention(state, actionPlan);
    saveEntry(text, state, actionPlan);
}

function applyIntervention(state, actionPlan) {
    const section = document.getElementById('interventionSection');
    const content = document.getElementById('interventionContent');
    
    section.classList.remove('hidden');
    
    let recommendation = "";
    let stateLabel = state;

    if (state === "Stressed") {
        recommendation = `
            <div class="state-badge state-Stressed">Stressed / Overwhelmed</div>
            <h3 style="margin-bottom:12px; font-size: 1.3rem;">Coach's Insight</h3>
            <p style="margin-bottom:20px; line-height: 1.6; color: var(--text-secondary);"><strong>Action suggested:</strong> ${actionPlan}</p>
        `;
    } else if (state === "Distracted") {
        recommendation = `
            <div class="state-badge state-Distracted">Distracted</div>
            <h3 style="margin-bottom:12px; font-size: 1.3rem;">Coach's Insight</h3>
            <p style="margin-bottom:20px; line-height: 1.6; color: var(--text-secondary);"><strong>Action suggested:</strong> ${actionPlan}</p>
        `;
    } else if (state === "Engaged" || state === "Motivated") {
        recommendation = `
            <div class="state-badge state-${state}">${state}</div>
            <h3 style="margin-bottom:12px; font-size: 1.3rem;">Flow State Detected</h3>
            <p style="margin-bottom:20px; line-height: 1.6; color: var(--text-secondary);"><strong>Action suggested:</strong> ${actionPlan}</p>
        `;
    }

    content.innerHTML = recommendation;
}

// ===== Journal History Logic =====

function getHistory() {
    const stored = localStorage.getItem('ifocus_journal_history');
    return stored ? JSON.parse(stored) : [];
}

function saveEntry(text, state, actionPlan) {
    const history = getHistory();
    history.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        text: text,
        state: state,
        actionPlan: actionPlan
    });
    localStorage.setItem('ifocus_journal_history', JSON.stringify(history));
    renderHistory();
    document.getElementById('reflectionInput').value = '';
}

function renderHistory() {
    const historyContainer = document.getElementById('journalHistory');
    const history = getHistory();

    if (history.length === 0) {
        historyContainer.innerHTML = `
            <div class="empty-state" style="padding: 2rem 1rem;">
                <p>No journal entries yet.</p>
                <p style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-secondary);">Your daily reflections will appear here.</p>
            </div>
        `;
        return;
    }

    historyContainer.innerHTML = history.map((entry, idx) => `
        <div class="journal-entry" onclick="viewPastEntry(${idx})">
            <div class="entry-date">${new Date(entry.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="entry-preview">${entry.text}</span>
                <span class="state-badge state-${entry.state}" style="margin: 0; transform: scale(0.7); transform-origin: right;">${entry.state}</span>
            </div>
        </div>
    `).join('');
}

// Expose to window for inline onclick
window.viewPastEntry = function(index) {
    const history = getHistory();
    const entry = history[index];
    if (!entry) return;

    document.getElementById('reflectionInput').value = entry.text;
    applyIntervention(entry.state, entry.actionPlan);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
