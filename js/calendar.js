// js/calendar.js

// Get the current user
const currentUser = localStorage.getItem('currentUser');

// Check if user is logged in
if (!currentUser) {
  window.location.href = 'login.html';
}

function goBack() {
  window.location.href = 'index.html';
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
let calendarEntries = JSON.parse(localStorage.getItem(`calendarEntries_${currentUser}`)) || {};

function initCalendar() {
  const container = document.querySelector('.calendar-container');
  container.innerHTML = ''; // Clear previous content if any
  daysOfWeek.forEach(day => {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    const dayTitle = document.createElement('h2');
    dayTitle.textContent = day;
    const textarea = document.createElement('textarea');
    textarea.value = calendarEntries[day] || '';
    textarea.oninput = () => {
      calendarEntries[day] = textarea.value;
      localStorage.setItem(`calendarEntries_${currentUser}`, JSON.stringify(calendarEntries));
    };
    dayDiv.appendChild(dayTitle);
    dayDiv.appendChild(textarea);
    container.appendChild(dayDiv);
  });
}

window.onload = initCalendar;
