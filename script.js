document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const dropZone = document.getElementById('dropZone');
    const pdfUpload = document.getElementById('pdfUpload');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const notesArea = document.getElementById('notesArea');
    const generateBtn = document.getElementById('generateBtn');
    
    const collectionsSection = document.getElementById('collectionsSection');
    const collectionsGrid = document.getElementById('collectionsGrid');
    const showCreateBtn = document.getElementById('showCreateBtn');
    const backToCollectionsBtn = document.getElementById('backToCollectionsBtn');
    const inputSection = document.getElementById('inputSection');
    const loadingSection = document.getElementById('loadingSection');
    const deckSection = document.getElementById('deckSection');
    
    const progressFill = document.getElementById('progressFill');
    const flashcardContainer = document.getElementById('flashcardContainer');
    
    const prevCardBtn = document.getElementById('prevCardBtn');
    const nextCardBtn = document.getElementById('nextCardBtn');
    const cardCounter = document.getElementById('cardCounter');
    const newDeckBtn = document.getElementById('newDeckBtn');
    const saveDeckBtn = document.getElementById('saveDeckBtn');
    const deckNameInput = document.getElementById('deckNameInput');
    const activeDeckTitle = document.getElementById('activeDeckTitle');

    // State
    let extractedText = "";
    let currentCards = [];
    let currentCardIndex = 0;
    let currentDeckSaved = false;

    // ===== Collections Management =====
    function getCollections() {
        const stored = localStorage.getItem('ifocus_flashcard_collections');
        return stored ? JSON.parse(stored) : [];
    }

    function saveCollections(collections) {
        localStorage.setItem('ifocus_flashcard_collections', JSON.stringify(collections));
    }

    function renderCollections() {
        const collections = getCollections();

        if (collections.length === 0) {
            collectionsGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No collections yet</p>
                    <p>Generate your first flashcard deck to get started!</p>
                </div>
            `;
            return;
        }

        collectionsGrid.innerHTML = collections.map((col, idx) => `
            <div class="collection-card" data-index="${idx}">
                <button class="delete-collection" data-index="${idx}" title="Delete collection">&times;</button>
                <h4>${col.name}</h4>
                <span class="card-count">${col.cards.length} card${col.cards.length !== 1 ? 's' : ''}</span>
                <p class="collection-date">${new Date(col.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
        `).join('');

        // Attach click events to open a collection
        collectionsGrid.querySelectorAll('.collection-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.delete-collection')) return;
                const idx = Number(card.dataset.index);
                openCollection(idx);
            });
        });

        // Attach delete events
        collectionsGrid.querySelectorAll('.delete-collection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = Number(btn.dataset.index);
                const collections = getCollections();
                if (confirm(`Delete "${collections[idx].name}"?`)) {
                    collections.splice(idx, 1);
                    saveCollections(collections);
                    renderCollections();
                }
            });
        });
    }

    function openCollection(index) {
        const collections = getCollections();
        const col = collections[index];
        if (!col) return;

        currentCards = col.cards;
        currentDeckSaved = true;
        activeDeckTitle.textContent = col.name;
        saveDeckBtn.style.display = 'none';
        
        collectionsSection.classList.add('hidden');
        inputSection.classList.add('hidden');
        deckSection.classList.remove('hidden');
        initDeck();
    }

    function showCollections() {
        collectionsSection.classList.remove('hidden');
        inputSection.classList.add('hidden');
        deckSection.classList.add('hidden');
        loadingSection.classList.add('hidden');
        renderCollections();
    }

    // ===== Navigation between views =====
    showCreateBtn.addEventListener('click', () => {
        collectionsSection.classList.add('hidden');
        inputSection.classList.remove('hidden');
        deckNameInput.value = '';
        notesArea.value = '';
        extractedText = '';
        fileNameDisplay.textContent = '';
        if (pdfUpload) pdfUpload.value = '';
    });

    backToCollectionsBtn.addEventListener('click', showCollections);

    // --- Tab Switching ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        });
    });

    // --- File Drag & Drop ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    pdfUpload.addEventListener('change', function() {
        handleFiles(this.files);
    });

    async function handleFiles(files) {
        if (files.length === 0) return;
        const file = files[0];
        
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file.');
            return;
        }

        fileNameDisplay.textContent = `Selected: ${file.name}`;
        
        // Auto-fill deck name from filename
        if (!deckNameInput.value) {
            deckNameInput.value = file.name.replace('.pdf', '');
        }

        try {
            extractedText = await extractTextFromPDF(file);
            console.log("PDF Text Extracted, length:", extractedText.length);
        } catch (error) {
            console.error("Error reading PDF", error);
            alert("Could not read PDF file.");
        }
    }

    // --- PDF.js Text Extraction ---
    async function extractTextFromPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        let fullText = "";
        
        // Extract from first 10 pages max to avoid huge payloads
        const maxPages = Math.min(pdf.numPages, 10);
        
        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            let pageText = "";
            let lastY = -1;
            
            for (const item of textContent.items) {
                if (lastY !== item.transform[5] && lastY !== -1) {
                    pageText += "\n";
                }
                pageText += item.str;
                lastY = item.transform[5];
            }
            
            fullText += pageText + "\n";
        }
        return fullText;
    }



    // --- Generate Deck ---
    generateBtn.addEventListener('click', async () => {
        // Determine input source
        const activeTab = document.querySelector('.tab.active').dataset.target;
        let contentToProcess = "";
        
        if (activeTab === 'text-input') {
            contentToProcess = notesArea.value.trim();
        } else {
            contentToProcess = extractedText;
        }

        if (!contentToProcess) {
            alert("Please provide some text or upload a PDF first.");
            return;
        }

        // Show loading state
        inputSection.classList.add('hidden');
        loadingSection.classList.remove('hidden');
        
        // Animate progress bar
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            progressFill.style.width = `${progress}%`;
        }, 500);

        try {
            currentCards = await generateFlashcards(contentToProcess);
            currentDeckSaved = false;
            clearInterval(progressInterval);
            progressFill.style.width = `100%`;
            
            // Set deck title
            const deckName = deckNameInput.value.trim() || 'Untitled Deck';
            activeDeckTitle.textContent = deckName;
            saveDeckBtn.style.display = '';

            setTimeout(() => {
                loadingSection.classList.add('hidden');
                deckSection.classList.remove('hidden');
                initDeck();
            }, 800);
            
        } catch (error) {
            clearInterval(progressInterval);
            alert("Error generating flashcards: " + error.message);
            loadingSection.classList.add('hidden');
            inputSection.classList.remove('hidden');
        }
    });

    // --- AI Generation Logic ---
    async function generateFlashcards(text) {
        // Use Gemini API via Serverless Backend
        // Truncate text to avoid token limits on free tier (approx 30,000 chars)
        const truncatedText = text.substring(0, 30000);
        
        const prompt = `
            Analyze the following educational material and extract the most important terms, concepts, formulas, or dates.
            Generate exactly 5-10 high-quality flashcards based on this material.
            
            CRITICAL INSTRUCTIONS: 
            1. The text may be extracted from a PDF and contain random line breaks, typos, or messy OCR formatting. You must intelligently ignore this messiness and extract the logical concepts.
            2. The "front" of the card MUST ONLY be the term, concept name, or short question. It MUST NOT contain the answer or definition itself. 
            3. The "back" of the card MUST contain the core definition or answer. Do NOT copy full paragraphs. Distill it into a few short, punchy keywords or a concise summary.
            
            Return the output STRICTLY as a JSON array of objects with this format. Do not use markdown blocks:
            [
              {
                "tag": "Definition|Concept|Formula|Date|Fact",
                "front": "The Term or Concept ONLY",
                "back": "Concise keywords or short summary (e.g., 'Requires oxygen to survive')"
              }
            ]
            
            Material:
            ${truncatedText}
        `;

        try {
            let modelToUse = localStorage.getItem('cached_gemini_model') || 'models/gemini-1.5-flash';
            let response = await fetch(`/api/generateContent?model=${encodeURIComponent(modelToUse)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
                })
            });

            // If 404 Not Found, automatically discover which models the backend actually has access to
            if (response.status === 404) {
                console.log("Model not found. Auto-discovering available models...");
                const modelsRes = await fetch(`/api/models`);
                if (modelsRes.ok) {
                    const modelsData = await modelsRes.json();
                    const availableModels = modelsData.models || [];
                    
                    // Find a model that supports generateContent and has 'gemini' in the name
                    const validModel = availableModels.find(m => 
                        m.supportedGenerationMethods && 
                        m.supportedGenerationMethods.includes('generateContent') && 
                        m.name.includes('gemini')
                    );

                    if (validModel) {
                        console.log("Auto-discovered working model:", validModel.name);
                        modelToUse = validModel.name;
                        localStorage.setItem('cached_gemini_model', modelToUse);
                        
                        // Retry with the discovered model
                        response = await fetch(`/api/generateContent?model=${encodeURIComponent(modelToUse)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: prompt }] }],
                                generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
                            })
                        });
                    } else {
                        throw new Error("API Request Failed: The backend API key has no access to any Gemini text models.");
                    }
                }
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error("API Error Response:", errorText);
                throw new Error(`API Request Failed (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            const textResponse = data.candidates[0].content.parts[0].text;
            
            try {
                // Strip out markdown ```json ... ``` formatting
                const cleanJson = textResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
                const parsed = JSON.parse(cleanJson);
                
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                } else {
                    throw new Error("Invalid format received from AI.");
                }
            } catch (e) {
                console.error("Parse error", e, textResponse);
                throw new Error("Failed to parse AI response. It might have been formatted incorrectly.");
            }
            
        } catch (error) {
            console.error("Generation Error:", error);
            throw error;
        }
    }

    // --- Deck UI Logic ---
    function initDeck() {
        if (currentCards.length === 0) return;
        currentCardIndex = 0;
        renderCard();
        updateControls();
    }

    function renderCard() {
        const cardData = currentCards[currentCardIndex];
        
        flashcardContainer.innerHTML = `
            <div class="flashcard" id="currentCard">
                <div class="card-face card-front">
                    <span class="tag">${cardData.tag || 'Flashcard'}</span>
                    <div class="card-content">${cardData.front}</div>
                    <div class="flip-hint">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
                        Click to flip
                    </div>
                </div>
                <div class="card-face card-back">
                    <div class="card-content">${cardData.back}</div>
                </div>
            </div>
        `;

        const cardEl = document.getElementById('currentCard');
        cardEl.addEventListener('click', () => {
            cardEl.classList.toggle('flipped');
        });
    }

    function updateControls() {
        cardCounter.textContent = `${currentCardIndex + 1} / ${currentCards.length}`;
        prevCardBtn.disabled = currentCardIndex === 0;
        nextCardBtn.disabled = currentCardIndex === currentCards.length - 1;
    }

    prevCardBtn.addEventListener('click', () => {
        if (currentCardIndex > 0) {
            currentCardIndex--;
            renderCard();
            updateControls();
        }
    });

    nextCardBtn.addEventListener('click', () => {
        if (currentCardIndex < currentCards.length - 1) {
            currentCardIndex++;
            renderCard();
            updateControls();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (deckSection.classList.contains('hidden')) return;
        
        if (e.code === 'Space') {
            e.preventDefault();
            const cardEl = document.getElementById('currentCard');
            if (cardEl) cardEl.classList.toggle('flipped');
        } else if (e.code === 'ArrowRight' && !nextCardBtn.disabled) {
            nextCardBtn.click();
        } else if (e.code === 'ArrowLeft' && !prevCardBtn.disabled) {
            prevCardBtn.click();
        }
    });

    // ===== Save Deck to Collections =====
    saveDeckBtn.addEventListener('click', () => {
        if (currentDeckSaved) return;
        const name = activeDeckTitle.textContent || 'Untitled Deck';
        const collections = getCollections();
        collections.unshift({
            name: name,
            cards: currentCards,
            createdAt: new Date().toISOString(),
        });
        saveCollections(collections);
        currentDeckSaved = true;
        saveDeckBtn.textContent = 'Saved!';
        saveDeckBtn.style.borderColor = 'var(--success)';
        saveDeckBtn.style.color = 'var(--success)';
        setTimeout(() => {
            saveDeckBtn.innerHTML = 'Save to Collections';
        }, 2000);
    });

    // ===== New Deck / Back =====
    newDeckBtn.addEventListener('click', () => {
        showCollections();
        progressFill.style.width = '0%';
        notesArea.value = '';
        extractedText = '';
        fileNameDisplay.textContent = '';
        pdfUpload.value = '';
    });

    // ===== Initial render: show collections =====
    renderCollections();
});
