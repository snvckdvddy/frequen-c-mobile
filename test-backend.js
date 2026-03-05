async function runTests() {
    const API_BASE_URL = process.env.TEST_API_BASE_URL || 'http://127.0.0.1:5000/api';
    const SOCKET_URL =
        process.env.TEST_SOCKET_URL || API_BASE_URL.replace(/\/api\/?$/, '');
    const TEST_EMAIL = process.env.TEST_EMAIL || 'integrationbot@freq.local';
    const TEST_USERNAME = process.env.TEST_USERNAME || 'integrationbot';
    const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

    console.log('--- Frequen-C Backend API Tests ---');
    console.log('API:', API_BASE_URL);
    console.log('Socket:', SOCKET_URL);

    // 1. Ensure user exists (register once), then login to get a token
    console.log('\n[0] Ensuring test account exists...');
    const registerRes = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TEST_USERNAME, email: TEST_EMAIL, password: TEST_PASSWORD })
    });
    if (registerRes.status === 201) {
        console.log('✅ Test account created.');
    } else if (registerRes.status === 409) {
        console.log('✅ Test account already exists.');
    } else {
        const registerData = await registerRes.json().catch(() => ({}));
        console.error('❌ Register failed unexpectedly:', registerRes.status, registerData);
        process.exitCode = 1;
        return;
    }

    console.log('\n[1] Testing Authentication (Login)...');
    const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token || !loginData.user) {
        console.error('❌ Login failed:', loginRes.status, loginData);
        return;
    }

    const token = loginData.token;
    const user = loginData.user;
    console.log('✅ Login successful. Received token for:', user.username);

    // 2. Create a Session
    console.log('\n[2] Testing Session Creation...');
    const sessionRes = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            name: 'Test Room Automation',
            genre: 'Testing',
            roomMode: 'campfire',
            isPublic: true
        })
    });

    const sessionData = await sessionRes.json();
    if (!sessionRes.ok || !sessionData.session) {
        console.error('❌ Session creation failed:', sessionRes.status, sessionData);
        return;
    }

    const session = sessionData.session;
    console.log(`✅ Session created successfully: ${session.name} (ID: ${session.id})`);
    console.log(`   Host: ${session.hostUsername}`);

    // 3. Connect via WebSocket
    console.log('\n[3] Testing WebSocket Connection...');
    const io = require('socket.io-client');
    const socket = io(SOCKET_URL, {
        auth: { token },
        reconnection: false
    });

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Socket connection timed out'));
        }, 5000);

        socket.on('connect', () => {
            clearTimeout(timeout);
            console.log('✅ Socket connected! ID:', socket.id);

            // Try to join the room
            console.log(`   Joining room ${session.id}...`);
            socket.emit('join-session', { sessionId: session.id });

            socket.on('room-state', (roomState) => {
                console.log('✅ Joined room via socket successfully:', roomState.sessionId);
                socket.disconnect();
                resolve();
            });
        });

        socket.on('connect_error', (err) => {
            clearTimeout(timeout);
            console.error('❌ Socket connection error:', err.message);
            reject(err);
        });
    });

    console.log('\n✅ All backend tests completed successfully!');
}

runTests().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
