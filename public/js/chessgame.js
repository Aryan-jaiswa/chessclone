const socket = io();
const chess = new Chess();
const boardElement = document.getElementById('board');

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let lastMoveSquares = [];
let whiteTime = 300;
let blackTime = 300;
let currentTurn = 'w';
let timerInterval;

const PIECE_UNICODE = {
    p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚',
    P: '♙', R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔',
};

const squareName = (row, col) => String.fromCharCode(97 + col) + (8 - row);

const getPieceUnicode = (piece) => {
    const key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
    return PIECE_UNICODE[key];
};

const highlightSquares = ([from, to]) => {
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('last-move');
    });

    if (from && to) {
        const fromSquare = document.querySelector(`[data-square='${from}']`);
        const toSquare = document.querySelector(`[data-square='${to}']`);
        if (fromSquare) fromSquare.classList.add('last-move');
        if (toSquare) toSquare.classList.add('last-move');
    }
};

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = '';

    board.forEach((row, rowIndex) => {
        row.forEach((square, colIndex) => {
            const squareElement = document.createElement("div");
            const coord = squareName(rowIndex, colIndex);

            squareElement.classList.add('square', (rowIndex + colIndex) % 2 === 0 ? 'light' : 'dark');
            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = colIndex;
            squareElement.dataset.square = coord;

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add('piece', square.color === 'w' ? 'white' : 'black');
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = (playerRole === square.color);

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: colIndex };
                        e.dataTransfer.setData("text/plain", "");
                        setTimeout(() => draggedPiece.classList.add("dragging"), 0);
                    }
                });

                pieceElement.addEventListener("dragend", () => {
                    draggedPiece.classList.remove("dragging");
                    draggedPiece = null;
                    sourceSquare = null;
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col),
                    };
                    handleMove(sourceSquare, targetSquare);
                }
            });

            boardElement.appendChild(squareElement);
        });
    });

    highlightSquares(lastMoveSquares);
    maybeFlipBoard();
    updateTimers();
};

const handleMove = (source, target) => {
    const from = squareName(source.row, source.col);
    const to = squareName(target.row, target.col);
    const move = chess.move({ from, to, promotion: 'q' });

    if (move) {
        lastMoveSquares = [from, to];
        playMoveSound();
        renderBoard();
        socket.emit('move', move);
        checkGameOver();
    }
};

const playMoveSound = () => {
    const sound = new Audio('/move.mp3');
    sound.play();
};

const maybeFlipBoard = () => {
    boardElement.style.transform = (playerRole === 'b') ? 'rotate(180deg)' : 'none';
    document.querySelectorAll('.square').forEach(square => {
        square.style.transform = (playerRole === 'b') ? 'rotate(180deg)' : 'none';
    });
};

const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const updateTimers = () => {
    document.getElementById('white-timer').textContent = formatTime(whiteTime);
    document.getElementById('black-timer').textContent = formatTime(blackTime);
};

const startTimer = () => {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (currentTurn === 'w') whiteTime--;
        else blackTime--;
        updateTimers();
    }, 1000);
};

const checkGameOver = () => {
    if (chess.game_over()) {
        alert("🎯 Game Over!\n" + (
            chess.in_checkmate() ? "Checkmate!" :
                chess.in_stalemate() ? "Stalemate!" :
                    "Draw!"
        ));
        const pgn = chess.pgn();
        navigator.clipboard.writeText(pgn);
        alert("📋 PGN copied to clipboard!");
        clearInterval(timerInterval);
    }
};

// === SOCKET EVENTS ===
socket.on('connect', () => console.log('✅ Connected to server'));

socket.on('playerRole', (role) => {
    playerRole = role;
    currentTurn = chess.turn();
    renderBoard();
    startTimer();
});

socket.on('spectatorRole', () => {
    playerRole = null;
    renderBoard();
});

socket.on('move', (move) => {
    chess.move(move);
    lastMoveSquares = [move.from, move.to];
    currentTurn = chess.turn();
    renderBoard();
    playMoveSound();
    checkGameOver();
});

socket.on('boardState', (fen) => {
    chess.load(fen);
    renderBoard();
});

socket.on('invalidMove', () => alert("❌ Invalid move!"));

// === CHAT ===
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

chatInput.addEventListener("keypress", (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
        socket.emit('chat', chatInput.value.trim());
        chatInput.value = '';
    }
});

socket.on('chat', (msg) => {
    const msgEl = document.createElement("div");
    msgEl.textContent = msg;
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});
