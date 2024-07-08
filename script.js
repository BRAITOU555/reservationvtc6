let map;
let pickupMarker;
let dropoffMarker;
let directionsService;
let directionsRenderer;

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 48.8566, lng: 2.3522 }, // Centre de la carte sur Paris
        zoom: 12
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);

    const pickupInput = document.getElementById('pickup-location');
    const dropoffInput = document.getElementById('dropoff-location');

    const pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput);
    const dropoffAutocomplete = new google.maps.places.Autocomplete(dropoffInput);

    pickupAutocomplete.addListener('place_changed', function() {
        const place = pickupAutocomplete.getPlace();
        if (!place.geometry) {
            alert("Aucun détail disponible pour le lieu de prise en charge : '" + place.name + "'");
            return;
        }

        if (pickupMarker) {
            pickupMarker.setMap(null);
        }

        pickupMarker = new google.maps.Marker({
            map: map,
            position: place.geometry.location
        });

        map.panTo(place.geometry.location);
        calculateAndDisplayRoute();
    });

    dropoffAutocomplete.addListener('place_changed', function() {
        const place = dropoffAutocomplete.getPlace();
        if (!place.geometry) {
            alert("Aucun détail disponible pour le lieu de destination : '" + place.name + "'");
            return;
        }

        if (dropoffMarker) {
            dropoffMarker.setMap(null);
        }

        dropoffMarker = new google.maps.Marker({
            map: map,
            position: place.geometry.location
        });

        map.panTo(place.geometry.location);
        calculateAndDisplayRoute();
    });

    // Charger les réservations existantes
    loadReservations();
}

document.getElementById('locate-btn').addEventListener('click', function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const latlng = { lat: lat, lng: lng };

            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: latlng }, (results, status) => {
                if (status === 'OK') {
                    if (results[0]) {
                        document.getElementById('pickup-location').value = results[0].formatted_address;

                        if (pickupMarker) {
                            pickupMarker.setMap(null);
                        }

                        pickupMarker = new google.maps.Marker({
                            map: map,
                            position: latlng
                        });

                        map.panTo(latlng);
                        calculateAndDisplayRoute();
                    } else {
                        alert('Aucun résultat trouvé.');
                    }
                } else {
                    alert('Erreur de géolocalisation : ' + status);
                }
            });
        }, () => {
            alert('La géolocalisation a échoué.');
        });
    } else {
        alert('Votre navigateur ne supporte pas la géolocalisation.');
    }
});

document.getElementById('immediate-btn').addEventListener('click', function() {
    document.getElementById('reservation-type').value = 'immediate';
    document.getElementById('pickup-time').style.display = 'none';
    document.getElementById('pickup-time').required = false;
    document.getElementById('pickup-time-label').style.display = 'none';
    calculateAndDisplayFare();
    alert('Réservation tout de suite sélectionnée');
});

document.getElementById('scheduled-btn').addEventListener('click', function() {
    document.getElementById('reservation-type').value = 'scheduled';
    document.getElementById('pickup-time').style.display = 'block';
    document.getElementById('pickup-time').required = true;
    document.getElementById('pickup-time-label').style.display = 'block';
    alert('Réservation planifiée sélectionnée');
});

document.getElementById('reservation-form').addEventListener('submit', function(event) {
    event.preventDefault();

    const pickupLocation = document.getElementById('pickup-location').value.trim();
    const dropoffLocation = document.getElementById('dropoff-location').value.trim();
    const reservationType = document.getElementById('reservation-type').value;
    const pickupTime = reservationType === 'immediate' ? new Date().toISOString() : document.getElementById('pickup-time').value;

    if (pickupLocation === '' || dropoffLocation === '' || (reservationType === 'scheduled' && pickupTime === '')) {
        alert('Veuillez remplir tous les champs.');
        return;
    }

    const departureTime = reservationType === 'immediate' ? new Date() : new Date(pickupTime);

    // Utiliser l'API de Distance Matrix de Google Maps pour obtenir l'estimation du temps de trajet
    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
        {
            origins: [pickupLocation],
            destinations: [dropoffLocation],
            travelMode: 'DRIVING',
            drivingOptions: {
                departureTime: departureTime, // L'heure de départ spécifiée par l'utilisateur ou immédiate
                trafficModel: 'bestguess' // Correction ici : 'bestguess' au lieu de 'best_guess'
            }
        },
        function(response, status) {
            if (status !== 'OK') {
                alert('Erreur lors de la récupération des informations de distance.');
                return;
            }

            const result = response.rows[0].elements[0];
            if (!result) {
                alert('Aucune information de distance trouvée.');
                return;
            }

            const duration = result.duration_in_traffic ? result.duration_in_traffic.value : result.duration.value; // Durée en secondes
            const distance = result.distance.value; // Distance en mètres

            const distanceKm = distance / 1000;
            const durationHours = duration / 3600;

            // Calculer le tarif basé sur la distance et le temps de trajet
            const ratePerKm = 1.20; // Exemple de tarif par kilomètre
            const ratePerHour = 15.00; // Exemple de tarif horaire

            const distanceFare = distanceKm * ratePerKm;
            const timeFare = durationHours * ratePerHour;

            const estimatedFare = distanceFare + timeFare;

            // Appliquer la remise de 15%
            const discountedFare = estimatedFare * 0.85;

            // Afficher le tarif estimé et la durée à l'utilisateur
            document.getElementById('estimated-fare').innerText = `Tarif estimé après remise : ${discountedFare.toFixed(2)} €`;
            document.getElementById('estimated-time').innerText = `Durée estimée du trajet : ${(duration / 60).toFixed(0)} minutes`;

            // Envoyer la réservation au serveur
            fetch('http://localhost:3001/reserve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pickupLocation, dropoffLocation, pickupTime, reservationType, discountedFare })
            })
            .then(response => response.json())
            .then(data => {
                alert('Réservation confirmée');
            })
            .catch(error => {
                console.error('Erreur:', error);
                alert('Erreur lors de la réservation.');
            });
        }
    );
});

function calculateAndDisplayFare() {
    const pickupLocation = document.getElementById('pickup-location').value.trim();
    const dropoffLocation = document.getElementById('dropoff-location').value.trim();
    const reservationType = document.getElementById('reservation-type').value;
    const pickupTime = reservationType === 'immediate' ? new Date().toISOString() : document.getElementById('pickup-time').value;

    if (pickupLocation === '' || dropoffLocation === '' || (reservationType === 'scheduled' && pickupTime === '')) {
        return;
    }

    const departureTime = reservationType === 'immediate' ? new Date() : new Date(pickupTime);

    // Utiliser l'API de Distance Matrix de Google Maps pour obtenir l'estimation du temps de trajet
    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
        {
            origins: [pickupLocation],
            destinations: [dropoffLocation],
            travelMode: 'DRIVING',
            drivingOptions: {
                departureTime: departureTime, // L'heure de départ spécifiée par l'utilisateur ou immédiate
                trafficModel: 'bestguess' // Correction ici : 'bestguess' au lieu de 'best_guess'
            }
        },
        function(response, status) {
            if (status !== 'OK') {
                alert('Erreur lors de la récupération des informations de distance.');
                return;
            }

            const result = response.rows[0].elements[0];
            if (!result) {
                alert('Aucune information de distance trouvée.');
                return;
            }

            const duration = result.duration_in_traffic ? result.duration_in_traffic.value : result.duration.value; // Durée en secondes
            const distance = result.distance.value; // Distance en mètres

            const distanceKm = distance / 1000;
            const durationHours = duration / 3600;

            // Calculer le tarif basé sur la distance et le temps de trajet
            const ratePerKm = 1.20; // Exemple de tarif par kilomètre
            const ratePerHour = 15.00; // Exemple de tarif horaire

            const distanceFare = distanceKm * ratePerKm;
            const timeFare = durationHours * ratePerHour;

            const estimatedFare = distanceFare + timeFare;

            // Appliquer la remise de 15%
            const discountedFare = estimatedFare * 0.85;

            // Afficher le tarif estimé et la durée à l'utilisateur
            document.getElementById('estimated-fare').innerText = `Tarif estimé après remise : ${discountedFare.toFixed(2)} €`;
            document.getElementById('estimated-time').innerText = `Durée estimée du trajet : ${(duration / 60).toFixed(0)} minutes`;
        }
    );
}

function calculateAndDisplayRoute() {
    if (!pickupMarker || !dropoffMarker) return;

    directionsService.route(
        {
            origin: pickupMarker.getPosition(),
            destination: dropoffMarker.getPosition(),
            travelMode: 'DRIVING'
        },
        function(response, status) {
            if (status === 'OK') {
                directionsRenderer.setDirections(response);
            } else {
                window.alert('Directions request failed due to ' + status);
            }
        }
    );
}

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
