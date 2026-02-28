const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJfMTc3MjI0Mjk1MzE4NF9maWRoanBocWMiLCJ1c2VybmFtZSI6InRlc3Rib3QiLCJlbWFpbCI6InRlc3Rib3RAZnJlcS5sb2NhbCIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzcyMjQ0MTI1LCJleHAiOjE3NzI4NDg5MjV9.fB8CL_5Ud1Hj8eYp8cl2CjLz5oi2ZniJx_aN-FsrzaE';

async function testCreateSession() {
    const payload = {
        name: "Friday Night Vibes",
        genre: "Mixed",
        roomMode: "campfire",
        isPublic: true,
        behaviors: {
            queueOrdering: "roundRobin",
            skipAccess: "anyone",
            voteReordersQueue: false,
            requiresApproval: false,
            allowOverdrive: false,
            allowPhaseCancel: false,
            allowPhantomPower: false,
            forecastEnabled: false,
            duelEnabled: false
        }
    };

    try {
        const res = await fetch('http://127.0.0.1:5000/api/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

testCreateSession();
