const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const chess = new Chess();
let players = {};

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render("index", { title: "Chess.com Clone" });
});

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Assign player roles
    if (!players.white) {
        players.white = socket.id;
        socket.emit("playerRole", "w");
        console.log("Assigned white to", socket.id);
    } else if (!players.black) {
        players.black = socket.id;
        socket.emit("playerRole", "b");
        console.log("Assigned black to", socket.id);
    } else {
        socket.emit("spectatorRole");
        console.log("Assigned spectator to", socket.id);
    }

    // Send initial board state
    socket.emit("boardState", chess.fen());

    socket.on("move", (move) => {
        try {
            // Role-based move restriction
            if (chess.turn() === 'w' && socket.id !== players.white) return;
            if (chess.turn() === 'b' && socket.id !== players.black) return;

            const result = chess.move(move);
            if (result) {
                io.emit("move", move);
                io.emit("boardState", chess.fen());
            } else {
                console.log("Invalid Move");
                socket.emit("invalidMove", move);
            }
        } catch (err) {
            console.error("Error in move:", err);
            socket.emit("invalidMove", move);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        if (socket.id === players.white) {
            delete players.white;
        } else if (socket.id === players.black) {
            delete players.black;
        }
    });
});

server.listen(3000, () => {
    console.log('✅ Server running at http://localhost:3000');
});
