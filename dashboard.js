document.addEventListener('DOMContentLoaded', function() {
    const ws = new WebSocket('ws://localhost:3001');
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'reservation-update') {
            addReservationToTable(data.reservation);
        } else if (data.type === 'location-update') {
            updateDriverLocation(data);
        }
    };

    loadReservations();

    function loadReservations() {
        fetch('http://localhost:3001/reservations')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector('#reservations-table tbody');
            tableBody.innerHTML = '';

            data.forEach(reservation => {
                addReservationToTable(reservation);
            });
        })
        .catch(error => {
            console.error('Erreur lors du chargement des réservations:', error);
        });
    }

    function addReservationToTable(reservation) {
        const tableBody = document.querySelector('#reservations-table tbody');
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${reservation.id}</td>
            <td>${reservation.pickupLocation}</td>
            <td>${reservation.dropoffLocation}</td>
            <td>${new Date(reservation.pickupTime).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</td>
            <td>${reservation.reservationType}</td>
            <td>${reservation.discountedFare.toFixed(2)} €</td>
        `;
        tableBody.appendChild(row);
    }

    function updateDriverLocation(data) {
        // Mettre à jour la localisation du chauffeur sur la carte
        // Ici, vous pouvez utiliser l'API Google Maps pour afficher la localisation
    }
});
