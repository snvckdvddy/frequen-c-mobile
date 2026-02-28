const http = require('http');

async function runTests() {
    console.log('--- Frequen-C Backend API Tests ---');

    // 1. Login to get a token
    console.log('\n[1] Testing Authentication (Login)...');
    const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'testbot@freq.local', password: 'password123' })
    });

    const loginData = await loginRes.json();
    if (loginData.status !== 'success') {
        console.error('❌ Login failed:', loginData);
        return;
    }

    const token = loginData.data.token;
    const user = loginData.data.user;
    console.log('✅ Login successful. Received token for:', user.username);

    // 2. Create a Session
    console.log('\n[2] Testing Session Creation...');
    const sessionRes = await fetch('http://127.0.0.1:5000/api/sessions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            name: 'Test Room Automation',
            type: 'public',
            genres: ['Testing']
        })
    });

    const sessionData = await sessionRes.json();
    if (sessionData.status !== 'success') {
        console.error('❌ Session creation failed:', sessionData);
        return;
    }

    const session = sessionData.data.session;
    console.log(`✅ Session created successfully: ${session.name} (ID: ${session.id})`);
    console.log(`   Host: ${session.hostUsername}`);

    // 3. Connect via WebSocket
    console.log('\n[3] Testing WebSocket Connection...');
    const io = require('socket.io-client');
    const socket = io('http://127.0.0.1:5000', {
        auth: { token },
        query: { token },
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
            socket.emit('session:join_room', session.id);

            socket.on('session:joined_room_ack', (ack) => {
                console.log('✅ Joined room via socket successfully:', ack.sessionId);
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

runTests().catch(console.error);
