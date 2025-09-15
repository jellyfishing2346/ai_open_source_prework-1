document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Make canvas fill the window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // State variables
    const state = {
        myPlayerId: null,
        players: {},
        avatars: {},
        mapImage: new Image(),
        mapLoaded: false,
        ws: null,
    };

    // Load the map image
    state.mapImage.src = 'world.jpg';
    state.mapImage.onload = () => {
        state.mapLoaded = true;
    };

    // WebSocket connection to the shared game server
    state.ws = new WebSocket('wss://codepath-mmorg.onrender.com');

    state.ws.onopen = () => {
        console.log('Connected to the game server.');
        // Send a join message to the server
        const joinMessage = {
            "action": "join_game",
            "username": "Tim" // Replace with your name
        };
        state.ws.send(JSON.stringify(joinMessage));
    };
    
    // Function to update the player list UI
    function updatePlayerList() {
        const playersUl = document.getElementById('players-ul');
        if (!playersUl) return;
        playersUl.innerHTML = ''; // Clear the existing list

        const playerNames = Object.values(state.players).map(p => p.username).sort();

        playerNames.forEach(username => {
            const listItem = document.createElement('li');
            listItem.textContent = username;
            playersUl.appendChild(listItem);
        });
    }

    state.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        // console.log('Received message:', message);

        if (message.action === 'join_game' && message.success) {
            state.myPlayerId = message.playerId;
            state.players = message.players;
            state.avatars = message.avatars;

            for (const avatarName in state.avatars) {
                const avatar = state.avatars[avatarName];
                for (const direction in avatar.frames) {
                    avatar.frames[direction] = avatar.frames[direction].map(base64 => {
                        const img = new Image();
                        img.src = base64;
                        return img;
                    });
                }
            }
            updatePlayerList();
            requestAnimationFrame(gameLoop);
        } else if (message.action === 'players_moved') {
            for (const playerId in message.players) {
                if (state.players[playerId]) {
                    Object.assign(state.players[playerId], message.players[playerId]);
                }
            }
        } else if (message.action === 'player_joined') {
            state.players[message.player.id] = message.player;
            state.avatars[message.avatar.name] = message.avatar;
            for (const direction in message.avatar.frames) {
                message.avatar.frames[direction] = message.avatar.frames[direction].map(base64 => {
                    const img = new Image();
                    img.src = base64;
                    return img;
                });
            }
            updatePlayerList();
        } else if (message.action === 'player_left') {
            delete state.players[message.playerId];
            updatePlayerList();
        } else if (message.success === false) {
            console.error('Server error:', message.error);
        }
    };

    function gameLoop() {
        if (!state.mapLoaded || !state.myPlayerId || !state.players[state.myPlayerId]) {
            requestAnimationFrame(gameLoop);
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const myPlayer = state.players[state.myPlayerId];
        const camX = myPlayer.x - canvas.width / 2;
        const camY = myPlayer.y - canvas.height / 2;

        ctx.drawImage(state.mapImage, -camX, -camY);

        for (const playerId in state.players) {
            const player = state.players[playerId];
            const avatar = state.avatars[player.avatar];
            if (!avatar) continue;

            const playerX = player.x;
            const playerY = player.y;

            const frameIndex = player.animationFrame % avatar.frames[player.facing].length;
            const img = avatar.frames[player.facing][frameIndex];

            const drawX = playerX - camX;
            const drawY = playerY - camY;

            if (player.facing === 'west') {
                ctx.save();
                ctx.scale(-1, 1);
                ctx.drawImage(img, -drawX - img.width, drawY);
                ctx.restore();
            } else {
                ctx.drawImage(img, drawX, drawY);
            }

            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(player.username, drawX + img.width / 2, drawY - 5);
        }

        requestAnimationFrame(gameLoop);
    }
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    // --- MILESTONE 5 ADDITION (WASD) ---
    window.addEventListener('keydown', (e) => {
        let direction = null;
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
                direction = 'up';
                break;
            case 'ArrowDown':
            case 's':
                direction = 'down';
                break;
            case 'ArrowLeft':
            case 'a':
                direction = 'left';
                break;
            case 'ArrowRight':
            case 'd':
                direction = 'right';
                break;
        }

        if (direction) {
            const moveMessage = {
                "action": "move",
                "direction": direction
            };
            state.ws.send(JSON.stringify(moveMessage));
        }
    });

    window.addEventListener('keyup', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
            const stopMessage = {
                "action": "stop"
            };
            state.ws.send(JSON.stringify(stopMessage));
        }
    });
});