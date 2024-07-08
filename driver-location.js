document.addEventListener('DOMContentLoaded', function() {
    const driverId = 'driver-id-example'; // Remplacez par l'ID du chauffeur

    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(position => {
            const { latitude, longitude } = position.coords;

            const ws = new WebSocket('ws://localhost:3001');
            ws.onopen = function() {
                ws.send(JSON.stringify({
                    type: 'location-update',
                    id: driverId,
                    latitude,
                    longitude,
                }));
            };
        });
    } else {
        console.log("La géolocalisation n'est pas disponible dans ce navigateur.");
    }
});
