document.cookie = 'visite=1';
localStorage.setItem('cle', 'valeur');
const image = 'data:image/png;base64,AAAA';
const brouillon = sessionStorage.getItem('brouillon');
fetch('https://api.example.com/collecte', { method: 'POST', body: image + brouillon });
