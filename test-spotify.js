const http = require('http');

async function testSpotifyAuth() {
    console.log('--- Testing Spotify OAuth Flow ---');

    // 1. Get the Spotify Login URL
    console.log('\n[1] Fetching Spotify Authorization URL from backend...');
    const res = await fetch('http://127.0.0.1:5000/api/spotify/authorize');
    const data = await res.json();

    if (!data.authorizeUrl) {
        console.error('❌ Failed to get Spotify auth url:', data);
        return;
    }

    const authUrl = new URL(data.authorizeUrl);
    console.log('✅ Received Auth URL!');
    console.log('  Base URL:', authUrl.origin + authUrl.pathname);
    console.log('  Client ID:', authUrl.searchParams.get('client_id'));
    console.log('  Redirect URI:', authUrl.searchParams.get('redirect_uri'));

    if (authUrl.searchParams.get('redirect_uri') === 'https://freq-backend-tunnel.loca.lt/api/spotify/callback') {
        console.log('✅ Redirect URI is correctly configured for LocalTunnel!');
    } else {
        console.log('❌ Redriect URI is INCORRECT! Found:', authUrl.searchParams.get('redirect_uri'));
    }
}

testSpotifyAuth().catch(console.error);
