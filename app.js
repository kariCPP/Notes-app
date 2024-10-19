// js/app.js

// Retrieve current user
const currentUser = localStorage.getItem('currentUser');

// Check if user is logged in
if (!currentUser) {
  window.location.href = 'login.html';
}

// Notebook Data Structure
let notebooks = JSON.parse(localStorage.getItem(`notebooks_${currentUser}`)) || {};

// Current States
let currentSubject = null;
let currentPage = 1;
let currentPaperType = 'plain';

// Drawing Variables
let canvas, ctx;
let drawing = false;
let tool = 'pen';
let brushColor = '#000000';
let brushSize = 5;
let panX = 0;
let panY = 0;
let startX, startY;
let isPanning = false;
let undoStack = [];
let redoStack = [];

// Color Palette
let defaultColors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
let customColors = JSON.parse(localStorage.getItem('customColors')) || [];

// Initialize the Application
window.onload = function () {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  if (currentTheme === 'dark') {
    setDarkTheme();
  } else {
    setLightTheme();
  }
  loadApplicationState();
  initColorPalette();
  setInterval(saveNotebooks, 5000); // Auto-save every 5 seconds
};

window.onbeforeunload = function () {
  saveNotebooks();
};

// Initialize Sidebar
function initSidebar() {
  const subjectList = document.getElementById('subjectList');
  subjectList.innerHTML = '';
  for (let subject in notebooks) {
    const subjectItem = document.createElement('li');
    const subjectLink = document.createElement('a');
    subjectLink.href = '#';
    subjectLink.textContent = capitalize(subject);
    subjectLink.onclick = () => openSubject(subject);
    subjectItem.appendChild(subjectLink);
    subjectList.appendChild(subjectItem);
  }
}

// Open Create Notebook Modal
function openCreateNotebookModal() {
  document.getElementById('createNotebookModal').style.display = 'block';
}

// Close Create Notebook Modal
function closeCreateNotebookModal() {
  document.getElementById('createNotebookModal').style.display = 'none';
}

// Create New Notebook
function createNotebook() {
  const notebookName = document.getElementById('notebookName').value.trim();
  const paperType = document.getElementById('paperType').value;
  if (notebookName) {
    if (!notebooks[notebookName]) {
      notebooks[notebookName] = { pages: [], paperType: paperType };
      saveNotebooks();
      initSidebar();
      closeCreateNotebookModal();
    } else {
      alert('Notebook already exists.');
    }
  } else {
    alert('Notebook name cannot be empty.');
  }
}

// Save Notebooks
function saveNotebooks() {
  localStorage.setItem(`notebooks_${currentUser}`, JSON.stringify(notebooks));
}

// Open a Notebook
function openSubject(subject) {
  currentSubject = subject;
  currentPage = 1;
  currentPaperType = notebooks[currentSubject].paperType || 'plain';
  document.getElementById('subjectTitle').textContent = capitalize(subject);

  // Show toolbar, pagination, and add page button
  document.getElementById('toolbar').style.display = 'flex';
  document.querySelector('.pagination').style.display = 'flex';
  document.querySelector('.add-page').style.display = 'block';

  // Initialize notebook pages if empty
  if (!notebooks[currentSubject].pages.length) {
    notebooks[currentSubject].pages.push('');
  }

  displayPage();
}

// Display the Current Page
function displayPage() {
  // Retrieve the canvas data URL
  const pageContent = notebooks[currentSubject].pages[currentPage - 1] || '';

  // Create canvas element
  document.getElementById('contentArea').innerHTML = `
    <canvas id="drawingCanvas" width="800" height="600"></canvas>
  `;

  canvas = document.getElementById('drawingCanvas');
  ctx = canvas.getContext('2d');

  // Set the paper background
  setCanvasBackground(currentPaperType);

  // Load the saved drawing if it exists
  if (pageContent) {
    const img = new Image();
    img.onload = function () {
      ctx.drawImage(img, 0, 0);
    };
    img.src = pageContent;
  }

  // Reset transformations
  ctx.setTransform(1, 0, 0, 1, panX, panY);

  // Add event listeners for drawing and panning
  addCanvasEventListeners();

  document.getElementById('currentPage').textContent = currentPage;
}

// Set Canvas Background
function setCanvasBackground(paperType) {
  const backgroundImg = new Image();
  backgroundImg.onload = function () {
    ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
    if (undoStack.length > 0) {
      restoreCanvas(undoStack[undoStack.length - 1]);
    }
  };
  backgroundImg.src = `images/${paperType}.png`;
}

// Add Event Listeners to Canvas
function addCanvasEventListeners() {
  canvas.onmousedown = function (e) {
    if (tool === 'pan') {
      isPanning = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
    } else {
      startDrawing(e);
    }
  };

  canvas.onmouseup = function (e) {
    if (isPanning) {
      isPanning = false;
    } else {
      stopDrawing(e);
    }
  };

  canvas.onmousemove = function (e) {
    if (isPanning) {
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      ctx.setTransform(1, 0, 0, 1, panX, panY);
      redrawCanvas();
    } else {
      draw(e);
    }
  };
}

// Save the Current Page Content
function savePage() {
  const dataURL = canvas.toDataURL();
  notebooks[currentSubject].pages[currentPage - 1] = dataURL;
  saveNotebooks();
}

// Drawing Functions
function startDrawing(e) {
  drawing = true;
  const rect = canvas.getBoundingClientRect();
  startX = (e.clientX - rect.left - panX);
  startY = (e.clientY - rect.top - panY);

  ctx.beginPath();
  ctx.moveTo(startX, startY);

  // Clear redo stack
  redoStack = [];

  if (tool === 'text') {
    const text = prompt('Enter text:');
    if (text) {
      ctx.fillStyle = brushColor;
      ctx.font = `${brushSize * 2}px Arial`;
      ctx.fillText(text, startX, startY);
      saveCanvasState();
      savePage();
    }
    drawing = false;
  } else if (tool === 'highlighter') {
    ctx.globalAlpha = 0.3;
  }
}

function stopDrawing(e) {
  if (!drawing) return;
  drawing = false;

  // Finalize the drawing shape
  if (['line', 'rectangle', 'circle'].includes(tool)) {
    const rect = canvas.getBoundingClientRect();
    const endX = (e.clientX - rect.left - panX);
    const endY = (e.clientY - rect.top - panY);

    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;

    if (tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    } else if (tool === 'rectangle') {
      ctx.strokeRect(startX, startY, endX - startX, endY - startY);
    } else if (tool === 'circle') {
      ctx.beginPath();
      const radius = Math.abs(endX - startX) / 2;
      const centerX = (startX + endX) / 2;
      const centerY = (startY + endY) / 2;
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = 'source-over'; // Reset to default drawing mode
  ctx.beginPath();

  saveCanvasState();
  savePage();
}

function draw(e) {
  if (!drawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - panX);
  const y = (e.clientY - rect.top - panY);

  if (tool === 'pen' || tool === 'eraser') {
    // Pen and eraser do not clear the canvas
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = (tool === 'eraser') ? 'rgba(255,255,255,1)' : brushColor;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  } else if (['line', 'rectangle', 'circle'].includes(tool)) {
    // Clear and preview shape in real-time for shapes
    ctx.clearRect(-panX, -panY, canvas.width, canvas.height);
    setCanvasBackground(currentPaperType);
    if (undoStack.length > 0) {
      const img = new Image();
      img.src = undoStack[undoStack.length - 1];
      img.onload = () => {
        ctx.drawImage(img, -panX, -panY);
        drawShapePreview(x, y); // Preview the shape in real-time
      };
    } else {
      drawShapePreview(x, y);
    }
  }
}

function drawShapePreview(endX, endY) {
  ctx.strokeStyle = brushColor;
  ctx.lineWidth = brushSize;

  // Switch tool and preview the shape
  if (tool === 'line') {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  } else if (tool === 'rectangle') {
    ctx.strokeRect(startX, startY, endX - startX, endY - startY);
  } else if (tool === 'circle') {
    const radius = Math.abs(endX - startX) / 2;
    const centerX = (startX + endX) / 2;
    const centerY = (startY + endY) / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Undo and Redo Functions
function saveCanvasState() {
  if (undoStack.length >= 50) {
    undoStack.shift();
  }
  undoStack.push(canvas.toDataURL());
}

function undo() {
  if (undoStack.length > 1) {
    redoStack.push(undoStack.pop());
    let lastState = undoStack[undoStack.length - 1];
    restoreCanvas(lastState);
  } else if (undoStack.length === 1) {
    redoStack.push(undoStack.pop());
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setCanvasBackground(currentPaperType);
    savePage();
  }
}

function redo() {
  if (redoStack.length > 0) {
    let nextState = redoStack.pop();
    undoStack.push(nextState);
    restoreCanvas(nextState);
  }
}

function restoreCanvas(dataURL) {
  let img = new Image();
  img.onload = function () {
    ctx.clearRect(-panX, -panY, canvas.width, canvas.height);
    setCanvasBackground(currentPaperType);
    ctx.drawImage(img, -panX, -panY);
  };
  img.src = dataURL || '';
  savePage();
}

// Tool Functions
function setTool(selectedTool) {
  tool = selectedTool;
}

function setColor(color) {
  brushColor = color;
}

function setBrushSize(size) {
  brushSize = size;
}

// Redraw Canvas
function redrawCanvas() {
  const img = new Image();
  img.onload = function () {
    ctx.clearRect(-panX, -panY, canvas.width, canvas.height);
    setCanvasBackground(currentPaperType);
    ctx.drawImage(img, -panX, -panY);
  };
  img.src = canvas.toDataURL();
}

// Export Functions
function exportAsImage() {
  // Reset transformations before exporting
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dataURL = canvas.toDataURL('image/png');
  ctx.restore();

  const link = document.createElement('a');
  link.href = dataURL;
  link.download = `${currentSubject}_Page${currentPage}.png`;
  link.click();
}

function exportAsPDF() {
  // Reset transformations before exporting
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dataURL = canvas.toDataURL('image/jpeg', 1.0);
  ctx.restore();

  const pdf = new jspdf.jsPDF('landscape');
  pdf.addImage(dataURL, 'JPEG', 10, 10, 280, 160);
  pdf.save(`${currentSubject}_Page${currentPage}.pdf`);
}

// Color Palette Functions
function initColorPalette() {
  const palette = document.getElementById('colorPalette');
  palette.innerHTML = '';
  const colors = defaultColors.concat(customColors);
  colors.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color;
    swatch.onclick = () => setColor(color);
    palette.appendChild(swatch);
  });
}

function addCustomColor(color) {
  if (!customColors.includes(color)) {
    customColors.push(color);
    localStorage.setItem('customColors', JSON.stringify(customColors));
    initColorPalette();
  }
}

// Navigate Pages
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    displayPage();
  }
}

function nextPage() {
  if (currentPage < notebooks[currentSubject].pages.length) {
    currentPage++;
    displayPage();
  }
}

function addPage() {
  notebooks[currentSubject].pages.push('');
  currentPage = notebooks[currentSubject].pages.length;
  displayPage();
}

// Utility Functions
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Calendar Functions
function goToCalendar() {
  window.location.href = 'calendar.html';
}

// Theme Functions
function toggleTheme() {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  if (currentTheme === 'dark') {
    setLightTheme();
  } else {
    setDarkTheme();
  }
}

function setDarkTheme() {
  document.documentElement.style.setProperty('--background-color', '#0D1B2A');
  document.documentElement.style.setProperty('--text-color', '#E0E1DD');
  document.documentElement.style.setProperty('--sidebar-color', '#1B263B');
  document.documentElement.style.setProperty('--accent-color', '#415A77');
  document.documentElement.style.setProperty('--canvas-background', '#FFFFFF');
  localStorage.setItem('theme', 'dark');
}

function setLightTheme() {
  document.documentElement.style.setProperty('--background-color', '#FFFFFF');
  document.documentElement.style.setProperty('--text-color', '#000000');
  document.documentElement.style.setProperty('--sidebar-color', '#E0E1DD');
  document.documentElement.style.setProperty('--accent-color', '#A9A9A9');
  document.documentElement.style.setProperty('--canvas-background', '#FFFFFF');
  localStorage.setItem('theme', 'light');
}

// Load Application State
function loadApplicationState() {
  // Load notebooks 
  notebooks = JSON.parse(localStorage.getItem(`notebooks_${currentUser}`)) || {};
  initSidebar();
}
