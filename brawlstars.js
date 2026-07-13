/* ═══════════════════════════════════════════════════════════════
   ClutchZone — BRAWL STARS LOBBY SCRIPT
   Interactive 3v3 team allocation & Gem Mine registration
═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Create Tournament Button
    const btnCreateTourBrawl = document.getElementById('btn-create-tour-brawl');
    if (btnCreateTourBrawl) {
      btnCreateTourBrawl.addEventListener('click', () => {
        setTimeout(() => {
          try {
            window.location.href = 'create-tournament.html';
          } catch (e) {
            window.open('create-tournament.html', '_self');
          }
        }, 50);
      });
    }

    // DOM Elements
    const gemCore = document.getElementById('gem-core');
    const blueTeamGrid = document.getElementById('blue-team');
    const redTeamGrid = document.getElementById('red-team');
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notification-message');
    
    // State
    let isRegistered = false;
    let myTeam = null;
    let mySlotIndex = null;
    
    // Mock Data - Brawlers and Players
    const brawlers = [
        { name: 'Shelly', class: 'Fighter', color: '#ffb300' },
        { name: 'Colt', class: 'Sharpshooter', color: '#ff4081' },
        { name: 'Nita', class: 'Fighter', color: '#4caf50' },
        { name: 'El Primo', class: 'Heavyweight', color: '#e53935' },
        { name: 'Barley', class: 'Thrower', color: '#8e24aa' },
        { name: 'Poco', class: 'Support', color: '#00bcd4' },
        { name: 'Spike', class: 'Sniper', color: '#69f0ae' },
        { name: 'Crow', class: 'Assassin', color: '#212121' },
        { name: 'Leon', class: 'Stealthy Assassin', color: '#aeea00' }
    ];

    const mockPlayers = [
        "xXBrawlerXx", "GemGrabber", "TrophyHunter", "StarPlayer", 
        "BushCamper", "ElPro", "Spin2Win", "Trickshot", "LagSpike"
    ];

    // Initial Team Setup
    const teams = {
        blue: [null, null, null],
        red: [null, null, null]
    };

    async function syncInitialState() {
        const saved = await window.CluchAPI?.getStore('cluchzone_brawl_teams', null);
        if (saved && saved.blue && saved.red) {
            teams.blue = saved.blue;
            teams.red = saved.red;
        }
    }

    function saveState() {
        window.CluchAPI?.setStore('cluchzone_brawl_teams', teams);
    }

    // Pre-fill some slots randomly
    function prefillTeams() {
        let filledCount = 0;
        const totalToFill = Math.floor(Math.random() * 4) + 1; // Fill 1 to 4 slots initially
        
        while (filledCount < totalToFill) {
            const team = Math.random() > 0.5 ? 'blue' : 'red';
            const slot = Math.floor(Math.random() * 3);
            
            if (!teams[team][slot]) {
                teams[team][slot] = generateMockPlayer();
                filledCount++;
            }
        }
    }

    function generateMockPlayer() {
        const player = mockPlayers[Math.floor(Math.random() * mockPlayers.length)];
        const brawler = brawlers[Math.floor(Math.random() * brawlers.length)];
        const trophies = Math.floor(Math.random() * 40000) + 10000;
        
        return {
            name: player,
            brawler: brawler.name,
            class: brawler.class,
            color: brawler.color,
            trophies: trophies
        };
    }

    function renderTeams() {
        if (!blueTeamGrid || !redTeamGrid) return;
        
        renderTeamGrid(blueTeamGrid, teams.blue, 'blue');
        renderTeamGrid(redTeamGrid, teams.red, 'red');
    }

    function renderTeamGrid(gridContainer, teamData, teamColor) {
        gridContainer.innerHTML = '';
        
        teamData.forEach((player, index) => {
            const slotElement = document.createElement('div');
            
            let classNames = `team-slot ${teamColor}-slot`;
            if (player) {
                classNames += ' occupied';
                if (player.isMe) classNames += ' me';
            } else {
                classNames += ' empty';
            }
            
            slotElement.className = classNames;
            
            if (player) {
                const brawlerInitial = player.brawler.charAt(0);
                slotElement.innerHTML = `
                    <div class="brawler-icon" style="background-color: ${player.color};">${brawlerInitial}</div>
                    <div class="player-info">
                        <span class="player-name">${player.name}</span>
                        <span class="brawler-name">${player.brawler} - 🏆 ${player.trophies}</span>
                    </div>
                `;
            } else {
                slotElement.innerHTML = `
                    <div class="empty-icon">+</div>
                    <div class="player-info">
                        <span class="player-name">Slot Vazio</span>
                        <span class="brawler-name">Aguardando jogador...</span>
                    </div>
                `;
            }

            // Click interaction for empty slots if registered
            if (!player && isRegistered) {
                slotElement.style.cursor = 'pointer';
                slotElement.addEventListener('click', () => joinSlot(teamColor, index));
            } else if (player && player.isMe) {
                slotElement.style.cursor = 'pointer';
                slotElement.title = "Clique para sair da equipe";
                slotElement.addEventListener('click', () => leaveSlot());
            }

            gridContainer.appendChild(slotElement);
        });
    }

    // Gem Core Interaction
    if (gemCore) {
        gemCore.addEventListener('click', () => {
            if (!isRegistered) {
                // Register
                gemCore.classList.add('active');
                gemCore.style.transform = 'scale(0.9)';
                setTimeout(() => { gemCore.style.transform = 'scale(1)'; }, 150);
                
                isRegistered = true;
                gemCore.innerHTML = `
                    <div class="gem-glow"></div>
                    <h2>MINA ATIVADA</h2>
                    <p>Escolha sua equipe abaixo!</p>
                `;
                
                showNotification('Mina ativada! Clique em um slot vazio para entrar na partida.', 'success');
                renderTeams(); // Re-render to make empty slots clickable
                
                // Play a gem grab sound (simulated)
                playSound('gem');
            } else if (myTeam) {
                showNotification('Você já está em uma equipe. Saia para trocar.', 'warning');
            } else {
                showNotification('Escolha um slot vazio em uma das equipes abaixo.', 'info');
            }
        });
    }

    function joinSlot(teamColor, index) {
        if (myTeam) {
            // Remove from previous slot
            teams[myTeam][mySlotIndex] = null;
        }
        
        myTeam = teamColor;
        mySlotIndex = index;
        
        teams[teamColor][index] = {
            name: "Meu Nick (Você)",
            brawler: "Aleatório",
            class: "Flex",
            color: "#e0e0e0",
            trophies: 25000,
            isMe: true
        };
        
        playSound('brawler');
        showNotification(`Você entrou na Equipe ${teamColor === 'blue' ? 'Azul' : 'Vermelha'}!`, 'success');
        renderTeams();
        saveState();
        checkMatchReady();
    }

    function leaveSlot() {
        if (myTeam && mySlotIndex !== null) {
            teams[myTeam][mySlotIndex] = null;
            myTeam = null;
            mySlotIndex = null;
            
            showNotification('Você saiu da equipe.', 'info');
            renderTeams();
            saveState();
        }
    }

    function showNotification(msg, type = 'info') {
        if (!notification || !notificationMessage) return;
        
        notificationMessage.textContent = msg;
        notification.className = `notification show ${type}`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    function playSound(type) {
        // In a real environment, we would load and play audio objects.
        // Here we just log or create a brief oscillator beep if we wanted.
        console.log(`[Sound Played]: ${type}`);
    }

    function checkMatchReady() {
        let isFull = true;
        for (let i=0; i<3; i++) {
            if (!teams.blue[i]) isFull = false;
            if (!teams.red[i]) isFull = false;
        }
        
        if (isFull) {
            setTimeout(() => {
                showNotification('BRAWL! A partida vai começar!', 'success');
                gemCore.classList.add('brawl-start');
                gemCore.innerHTML = `<h2>BRAWL!</h2>`;
            }, 500);
        }
    }

    // Initialize
    (async () => {
        await syncInitialState();
        if (!teams.blue.some(Boolean) && !teams.red.some(Boolean)) {
            prefillTeams();
            saveState();
        }
        renderTeams();
    })();

    // Floating animation for gems (if any exist via JS)
    setInterval(() => {
        const activeCore = document.querySelector('.gem-core.active');
        if (activeCore) {
            activeCore.style.filter = `hue-rotate(${Math.random() * 360}deg)`;
        }
    }, 2000);
});
