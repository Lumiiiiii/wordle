
// Configurazione Supabase
const SUPABASE_URL = 'https://nejuxfvknaklivnobhht.supabase.co/rest/v1/';
const SUPABASE_KEY = 'sb_publishable_e1No0FOt7NRiofrp2sEq8g_eVOKPq3n';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentStreak = parseInt(localStorage.getItem('wordle_streak')) || 0;
document.getElementById('current-streak').textContent = currentStreak;
let DICTIONARY = [];
let TARGET_WORD = "";

// Fetch dictionary from an external source (Napolux's list of Italian words)
async function loadDictionary() {
    showMessage("Caricamento dizionario...", 0); // show indefinitely
    try {
        const response = await fetch("https://raw.githubusercontent.com/napolux/paroleitaliane/master/paroleitaliane/660000_parole_italiane.txt");
        if (!response.ok) throw new Error("Errore di rete");
        const text = await response.text();

        // Filter only 5-letter words with alphabetical characters
        DICTIONARY = text.split('\n')
            .map(word => word.trim().toUpperCase())
            .filter(word => word.length === 5 && /^[A-Z]{5}$/.test(word));

        TARGET_WORD = DICTIONARY[Math.floor(Math.random() * DICTIONARY.length)];

        // Remove loading message
        document.getElementById('message-container').innerHTML = '';
    } catch (error) {
        console.error(error);
        showMessage("Errore nel caricamento del dizionario. Riprova più tardi.", 0);
    }
}
const ROWS = 6;
const COLS = 5;

// Game State
let currentR = 0;
let currentC = 0;
let isGameOver = false;
let isAnimating = false;
const board = [];

// UI Initialization
function initBoard() {
    const boardContainer = document.getElementById('board');
    for (let r = 0; r < ROWS; r++) {
        const rowObj = [];
        const rowElem = document.createElement('div');
        rowElem.classList.add('row');
        for (let c = 0; c < COLS; c++) {
            const tileElem = document.createElement('div');
            tileElem.classList.add('tile');
            tileElem.dataset.state = 'tbd';
            tileElem.id = `tile-${r}-${c}`;
            rowElem.appendChild(tileElem);
            rowObj.push(tileElem);
        }
        boardContainer.appendChild(rowElem);
        board.push(rowObj);
    }
}

function showMessage(msg, duration = 3000) {
    const container = document.getElementById('message-container');
    const msgEl = document.createElement('div');
    msgEl.textContent = msg;
    msgEl.classList.add('message');
    container.appendChild(msgEl);

    if (duration > 0) {
        setTimeout(() => {
            msgEl.classList.add('fade-out');
            setTimeout(() => msgEl.remove(), 500);
        }, duration);
    }
}

// Input Processing
function handleInput(key) {
    if (isGameOver || isAnimating) return;

    key = key.toUpperCase();

    if (key === 'ENTER') {
        submitGuess();
    } else if (key === 'BACKSPACE') {
        deleteLetter();
    } else if (/^[A-Z]$/.test(key)) {
        addLetter(key);
    }
}

function addLetter(letter) {
    if (currentC < COLS) {
        const tile = board[currentR][currentC];
        tile.textContent = letter;
        tile.dataset.state = 'active';

        // Re-trigger the pop animation by cloning node
        const newTile = tile.cloneNode(true);
        tile.parentNode.replaceChild(newTile, tile);
        board[currentR][currentC] = newTile;

        currentC++;
    }
}

function deleteLetter() {
    if (currentC > 0) {
        currentC--;
        const tile = board[currentR][currentC];
        tile.textContent = '';
        tile.dataset.state = 'tbd';
        tile.style.animation = 'none'; // reset animation
    }
}

function submitGuess() {
    if (DICTIONARY.length === 0) {
        showMessage("Attendi il caricamento del dizionario...");
        return;
    }
    if (currentC !== COLS) {
        showMessage("Parola troppo corta");
        return;
    }

    // Construct word
    let guess = "";
    for (let c = 0; c < COLS; c++) {
        guess += board[currentR][c].textContent;
    }

    // Verify if word is valid Italian 5-letter word
    if (!/^[A-Z]{5}$/.test(guess)) {
        showMessage("Caratteri non validi");
        return;
    }

    if (!DICTIONARY.includes(guess)) {
        showMessage("Parola non nel dizionario");
        // animate shake could go here
        return;
    }

    checkGuess(guess);
}

function checkGuess(guess) {
    isAnimating = true;

    const targetArray = TARGET_WORD.split('');
    const guessArray = guess.split('');
    const tileStatuses = new Array(COLS).fill('absent');

    // 1st pass: find exact matches (green)
    for (let i = 0; i < COLS; i++) {
        if (guessArray[i] === targetArray[i]) {
            tileStatuses[i] = 'correct';
            targetArray[i] = null; // Mark as used
        }
    }

    // 2nd pass: find partial matches (yellow)
    for (let i = 0; i < COLS; i++) {
        if (tileStatuses[i] !== 'correct' && targetArray.includes(guessArray[i])) {
            tileStatuses[i] = 'present';
            const indexToRemove = targetArray.indexOf(guessArray[i]);
            targetArray[indexToRemove] = null; // Mark as used
        }
    }

    // Animate row
    const animationDuration = 500; // ms
    const stagger = 250; // ms

    for (let i = 0; i < COLS; i++) {
        const tile = board[currentR][i];
        const status = tileStatuses[i];
        const letter = guessArray[i];

        setTimeout(() => {
            tile.style.animation = 'none';
            tile.offsetHeight; /* trigger reflow */

            tile.style.animation = `flip-in ${animationDuration / 2}ms ease-in forwards`;

            setTimeout(() => {
                tile.classList.add(status);
                tile.style.animation = `flip-out-${status} ${animationDuration / 2}ms ease-out forwards`;
                updateKeyboard(letter, status);
            }, animationDuration / 2);

            // End of row animation
            if (i === COLS - 1) {
                setTimeout(() => {
                    isAnimating = false;

                    // Check win/lose conditions
                    if (guess === TARGET_WORD) {
                        isGameOver = true;
                        animateWinJump();
                        setTimeout(() => endGame(true), 1500);
                    } else if (currentR === ROWS - 1) {
                        isGameOver = true;
                        setTimeout(() => endGame(false), 1500);
                    } else {
                        currentR++;
                        currentC = 0;
                    }
                }, animationDuration / 2);
            }

        }, i * stagger);
    }
}

function updateKeyboard(letter, status) {
    const keyEl = document.querySelector(`.key[data-key="${letter}"]`);
    if (!keyEl) return;

    const currentStatus = keyEl.classList.contains('correct') ? 'correct' :
        keyEl.classList.contains('present') ? 'present' :
            keyEl.classList.contains('absent') ? 'absent' : 'tbd';

    // correct overrides present, present overrides absent
    if (status === 'correct' || (status === 'present' && currentStatus !== 'correct') || (status === 'absent' && currentStatus !== 'correct' && currentStatus !== 'present')) {
        keyEl.classList.remove('correct', 'present', 'absent');
        keyEl.classList.add(status);
    }
}

// Event Listeners
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleInput('ENTER');
    } else if (e.key === 'Backspace') {
        handleInput('BACKSPACE');
    } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleInput(e.key.toUpperCase());
    }
});

document.querySelectorAll('.key').forEach(key => {
    key.addEventListener('click', () => {
        handleInput(key.dataset.key);
    });
});

// Animations and Endgame logic
let stats = JSON.parse(sessionStorage.getItem('wordleStats')) || { played: 0, won: 0 };

function animateWinJump() {
    for (let i = 0; i < COLS; i++) {
        const tile = board[currentR][i];
        setTimeout(() => {
            tile.classList.add('jump');
        }, i * 100);
    }
}

async function inviaPunteggio(nome, punteggio) {
    const { data, error } = await _supabase
        .from('classifica') // Assicurati che il nome sia identico a quello su Supabase
        .insert([{ username: nome, streak: punteggio }]);

    if (error) {
        console.error("Errore di salvataggio:", error);
    } else {
        console.log("Record salvato in classifica!");
    }
}

function endGame(won) {
    stats.played++;
    if (won) {
        stats.won++;
        currentStreak++; // Aumenta la scia di vittorie

        // Chiediamo il nome solo se ha vinto (dopo un timeout per far vedere l'animazione)
        setTimeout(() => {
            const nomeGiocatore = prompt("GRANDE! Hai vinto! Inserisci il tuo nome per la classifica globale:");
            if (nomeGiocatore) {
                inviaPunteggio(nomeGiocatore, currentStreak);
            }
        }, 100);
    } else {
        currentStreak = 0; // Se perdi, la streak torna a zero
    }

    // Salviamo la streak locale per la prossima volta
    localStorage.setItem('wordle_streak', currentStreak);
    document.getElementById('current-streak').textContent = currentStreak;

    sessionStorage.setItem('wordleStats', JSON.stringify(stats));

    document.getElementById('stat-played').textContent = stats.played;
    document.getElementById('stat-won').textContent = stats.won;

    let winPct = stats.played === 0 ? 0 : Math.round((stats.won / stats.played) * 100);
    document.getElementById('stat-winpct').textContent = winPct + '%';

    // Generate mini board
    let miniBoardHTML = '';
    for (let r = 0; r <= currentR; r++) {
        let rowStr = '';
        for (let c = 0; c < COLS; c++) {
            const status = board[r][c].classList.contains('correct') ? '🟩' :
                board[r][c].classList.contains('present') ? '🟨' : '⬛';
            rowStr += status;
        }
        miniBoardHTML += `<div class="mini-board-line">${rowStr}</div>`;
    }
    document.getElementById('mini-board-container').innerHTML = miniBoardHTML;

    document.getElementById('modal-title').textContent = won ? "Hai Vinto! 🎉" : "Sconfitta 😢";
    document.getElementById('modal-subtitle').textContent = won ? `Tentativo ${currentR + 1} di ${ROWS}` : `La parola era: ${TARGET_WORD}`;
    document.getElementById('message-container').innerHTML = ''; // clear messages
    document.getElementById('modal-overlay').style.display = 'flex';
}

function resetGame() {
    document.getElementById('modal-overlay').style.display = 'none';
    // Clear board
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const tile = board[r][c];
            tile.textContent = '';
            tile.dataset.state = 'tbd';
            tile.className = 'tile';
            tile.style.animation = 'none';
        }
    }
    // Clear keys
    document.querySelectorAll('.key').forEach(key => {
        key.classList.remove('correct', 'present', 'absent');
    });

    currentR = 0;
    currentC = 0;
    isGameOver = false;
    TARGET_WORD = DICTIONARY[Math.floor(Math.random() * DICTIONARY.length)];
}

// Start
initBoard();
loadDictionary();

