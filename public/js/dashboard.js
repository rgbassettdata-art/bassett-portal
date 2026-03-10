// Sample script to calculate and display remaining holidays
// In a real application this would fetch data from an API or server.

(function () {
    // hard-coded for demonstration
    const totalAnnualHolidays = 28;
    const takenHolidays = 10; // this would normally come from user data

    const daysLeftEl = document.getElementById('days-left');
    if (daysLeftEl) {
        const left = totalAnnualHolidays - takenHolidays;
        daysLeftEl.textContent = left;
    }
})();
