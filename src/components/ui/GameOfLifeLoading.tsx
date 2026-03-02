import React, { useState, useEffect, useCallback } from 'react';
import './GameOfLifeLoading.css';

interface GameOfLifeLoadingProps {
    onStart?: () => void;
    fadeOut?: boolean;
}

const ROWS = 25;
const COLS = 40;
const TICK_RATE = 150;

const createEmptyGrid = () => Array(ROWS).fill(Array(COLS).fill(0));

const randomizeGrid = () => {
    const grid = [];
    for (let i = 0; i < ROWS; i++) {
        const row = [];
        for (let j = 0; j < COLS; j++) {
            // 30% chance of being alive initially
            row.push(Math.random() > 0.7 ? 1 : 0);
        }
        grid.push(row);
    }
    return grid;
};

// Patterns for cool initial states
const createGliderGun = () => {
    const grid = createEmptyGrid().map(r => [...r]);
    // Offset to center it a bit
    const ox = 2;
    const oy = 5;

    // Gosper Glider Gun pattern
    const coordinates = [
        [0, 24], [1, 22], [1, 24], [2, 12], [2, 13], [2, 20], [2, 21], [2, 34], [2, 35],
        [3, 11], [3, 15], [3, 20], [3, 21], [3, 34], [3, 35], [4, 0], [4, 1], [4, 10], [4, 16], [4, 20], [4, 21],
        [5, 0], [5, 1], [5, 10], [5, 14], [5, 16], [5, 17], [5, 22], [5, 24],
        [6, 10], [6, 16], [6, 24], [7, 11], [7, 15], [8, 12], [8, 13]
    ];

    coordinates.forEach(([r, c]) => {
        if (r + oy < ROWS && c + ox < COLS) grid[r + oy][c + ox] = 1;
    });

    return grid;
};

const GameOfLifeLoading: React.FC<GameOfLifeLoadingProps> = ({ onStart, fadeOut }) => {
    const [grid, setGrid] = useState(() => createGliderGun());
    const [generation, setGeneration] = useState(0);

    const computeNextGeneration = useCallback((currentGrid: number[][]) => {
        const newGrid = currentGrid.map(arr => [...arr]);

        for (let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                let aliveNeighbors = 0;

                // Count 8 neighbors
                for (let x = -1; x <= 1; x++) {
                    for (let y = -1; y <= 1; y++) {
                        if (x === 0 && y === 0) continue;

                        const newI = i + x;
                        const newJ = j + y;

                        if (newI >= 0 && newI < ROWS && newJ >= 0 && newJ < COLS) {
                            aliveNeighbors += currentGrid[newI][newJ];
                        }
                    }
                }

                // Apply rules
                if (currentGrid[i][j] === 1 && (aliveNeighbors < 2 || aliveNeighbors > 3)) {
                    newGrid[i][j] = 0; // Underpopulation or overpopulation
                } else if (currentGrid[i][j] === 0 && aliveNeighbors === 3) {
                    newGrid[i][j] = 1; // Reproduction
                }
            }
        }

        return newGrid;
    }, []);

    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        if (!fadeOut) {
            intervalId = setInterval(() => {
                setGrid(g => computeNextGeneration(g));
                setGeneration(g => g + 1);
            }, TICK_RATE);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [computeNextGeneration, fadeOut]);

    return (
        <div className={`gol-loading-container ${fadeOut ? 'gol-fade-out' : ''}`}>
            <div className="gol-content">
                <div className="gol-grid">
                    {grid.map((row, i) => (
                        <div key={`row-${i}`} className="gol-row">
                            {row.map((col, j) => (
                                <div
                                    key={`cell-${i}-${j}`}
                                    className={`gol-cell ${col ? 'alive' : 'dead'}`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
                <div className="gol-generation">
                    GEN <span className="gol-gen-number">{String(generation).padStart(4, '0')}</span>
                </div>
                {onStart && (
                    <button className="gol-start-btn" onClick={onStart}>
                        START <span className="blink-cursor">_</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default GameOfLifeLoading;
