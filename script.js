// State
let currentDate = new Date();
let selectedDay = currentDate.getDate();
let shaderCalendar = null;
let soundSystem = null;

// DOM Elements
const canvas = document.getElementById('artCanvas');
const controls = document.getElementById('controls');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const datePicker = document.getElementById('datePicker');
const currentDaySpan = document.getElementById('currentDay');
const daysInMonthSpan = document.getElementById('daysInMonth');

// Initialize shader calendar (don't start animation yet)
function initShaderCalendar() {
    shaderCalendar = new ShaderCalendar('artCanvas');
    // Animation will start after first image loads
}

// Initialize sound system
async function initSoundSystem() {
    soundSystem = new DementiaSound();
    await soundSystem.init();
}

// Get days in current month
function getDaysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

// Get current month info
function getCurrentMonthInfo() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const currentDay = today.getDate();
    const daysInMonth = getDaysInMonth(today);

    return { year, month, currentDay, daysInMonth };
}

// Format date for input
function formatDateForInput(year, month, day) {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
}

// Load and display image for a specific day with shader effect
async function displayImage(day) {
    if (!shaderCalendar) {
        console.log('Initializing shader calendar...');
        initShaderCalendar();
    }

    console.log(`Loading image for day ${day}...`);

    try {
        await shaderCalendar.loadImage(`memory_01/${day}.jpg`, day);
        console.log(`Image loaded successfully for day ${day}`);

        // Start animation if not already started
        if (!shaderCalendar.animationId) {
            console.log('Starting shader animation...');
            shaderCalendar.startAnimation();
        }

        // Update sound if it's playing
        if (soundSystem && soundSystem.isPlaying) {
            soundSystem.updateDay(day);
        }
    } catch (error) {
        console.error(`Failed to load image for day ${day}:`, error);
        throw error; // Re-throw so we can see the error in init
    }
}

// Update UI state
async function updateUI() {
    const { year, month, currentDay, daysInMonth } = getCurrentMonthInfo();

    // Update info display
    currentDaySpan.textContent = selectedDay;
    daysInMonthSpan.textContent = daysInMonth;

    // Update date picker - TESTING MODE: Allow all 31 days
    datePicker.value = formatDateForInput(year, month, selectedDay);
    datePicker.max = formatDateForInput(year, month, 31); // Allow all days for testing
    datePicker.min = formatDateForInput(year, month, 1);

    // Update button states - TESTING MODE: Allow navigation to all days
    prevBtn.disabled = selectedDay <= 1;
    nextBtn.disabled = selectedDay >= 31; // Allow up to day 31 for testing

    // Display image with shader effect (await to ensure it loads)
    await displayImage(selectedDay);
}

// Navigation functions
function goToPreviousDay() {
    if (selectedDay > 1) {
        selectedDay--;
        updateUI();
    }
}

function goToNextDay() {
    // TESTING MODE: Allow navigation to all 31 days
    if (selectedDay < 31) {
        selectedDay++;
        updateUI();
    }
}

function goToDate(dateString) {
    const selectedDate = new Date(dateString);
    const { year, month } = getCurrentMonthInfo();

    // TESTING MODE: Allow any date 1-31 in current month
    if (selectedDate.getFullYear() === year &&
        selectedDate.getMonth() === month &&
        selectedDate.getDate() >= 1 &&
        selectedDate.getDate() <= 31) {
        selectedDay = selectedDate.getDate();
        updateUI();
    }
}

// Keyboard controls
document.addEventListener('keydown', async (e) => {
    if (e.key.toLowerCase() === 'c') {
        controls.classList.toggle('hidden');
    }
    if (e.key.toLowerCase() === 's') {
        console.log('S key pressed');
        if (!soundSystem) {
            console.log('Sound system not initialized, initializing now...');
            await initSoundSystem();
        }
        if (soundSystem) {
            console.log('Toggling sound for day', selectedDay);
            await soundSystem.toggle(selectedDay);

            // Update hint text
            const hint = document.querySelector('.hint');
            if (soundSystem.isPlaying) {
                hint.textContent = "Press 'C' to toggle controls | Press 'S' to toggle sound [SOUND ON]";
            } else {
                hint.textContent = "Press 'C' to toggle controls | Press 'S' to toggle sound [SOUND OFF]";
            }
        } else {
            console.error('Sound system failed to initialize');
        }
    }
});

// Button event listeners
prevBtn.addEventListener('click', goToPreviousDay);
nextBtn.addEventListener('click', goToNextDay);
datePicker.addEventListener('change', (e) => {
    goToDate(e.target.value);
});

// Auto-start sound on first user interaction
let soundAutoStarted = false;

async function autoStartSound() {
    if (soundAutoStarted) return;

    soundAutoStarted = true;

    if (!soundSystem) {
        await initSoundSystem();
    }

    if (soundSystem) {
        await soundSystem.start(selectedDay);
        console.log('Sound auto-started');

        // Update hint
        const hint = document.querySelector('.hint');
        hint.textContent = "Press 'C' to toggle controls | Press 'S' to toggle sound [SOUND ON]";
    }
}

// Listen for any user interaction to start sound
document.addEventListener('click', autoStartSound, { once: true });
document.addEventListener('keydown', autoStartSound, { once: true });

// Initialize
async function init() {
    console.log('=== Initializing Dementia Artwork ===');

    const { currentDay, daysInMonth } = getCurrentMonthInfo();

    // On first load, show current day's image
    selectedDay = currentDay;

    // But respect month limits (e.g., if it's day 31 but month has 30 days)
    if (selectedDay > daysInMonth) {
        selectedDay = daysInMonth;
    }

    console.log(`Current day: ${selectedDay} / ${daysInMonth}`);

    // Set canvas initial size
    canvas.width = 800;
    canvas.height = 800;

    // Initialize shader system FIRST
    console.log('Initializing shader system...');
    initShaderCalendar();

    // Initialize sound system in background (don't wait for it)
    console.log('Initializing sound system in background...');
    initSoundSystem().then(() => {
        console.log('Sound system ready');
    }).catch(err => {
        console.error('Sound system failed:', err);
    });

    // Load image and start visuals immediately (don't wait for sound)
    console.log('Loading initial image...');
    try {
        await updateUI();
        console.log('✓ Artwork started successfully');
        console.log('Click anywhere or press any key to start sound');
    } catch (error) {
        console.error('✗ Failed to start artwork:', error);
    }
}

// Start the app
init();
