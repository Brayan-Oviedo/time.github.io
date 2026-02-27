import { TimeUtils } from '../utils/timeUtils.js';

export class TimeStack {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.pixelsPerMinute = 2; // ESCALA: 2px por minuto = 2880px total
    }

    render(blocks) {
        this.container.innerHTML = ''; 
        this.renderGrid();
        
        const safeBlocks = Array.isArray(blocks) ? blocks : [];
        let sorted = safeBlocks.sort((a, b) => a.start - b.start);

        this.renderGaps(sorted);

        sorted = this.calculateOverlaps(sorted);
        sorted.forEach(block => this.drawBlock(block));

        this.renderNowLine();
    }

    renderGrid() {
        for (let i = 0; i < 24; i++) {
            const yPos = (i * 60) * this.pixelsPerMinute;
            const marker = document.createElement('div');
            marker.className = 'hour-marker';
            marker.style.top = `${yPos}px`;
            marker.innerHTML = `<span>${i.toString().padStart(2, '0')}:00</span>`;
            this.container.appendChild(marker);
        }

        const spacer = document.createElement('div');
        spacer.className = 'scroll-spacer';
        this.container.appendChild(spacer);
    }

    renderGaps(sortedBlocks) {
        const nowMinutes = TimeUtils.getCurrentDayMinutes();
        let cursor = 0; 

        sortedBlocks.forEach(block => {
            if (block.start > cursor + 1) {
                this.drawVoid(cursor, block.start);
            }
            if (block.end > cursor) {
                cursor = block.end;
            }
        });

        if (cursor < nowMinutes) {
            this.drawVoid(cursor, nowMinutes);
        }
    }

    drawVoid(start, end) {
        const div = document.createElement('div');
        div.className = 'time-gap';
        
        const top = start * this.pixelsPerMinute;
        const height = (end - start) * this.pixelsPerMinute;

        div.style.top = `${top}px`;
        div.style.height = `${Math.max(height, 20)}px`;
        
        div.dataset.start = start;
        div.dataset.end = end;
        div.innerHTML = `<span>?</span>`; 

        this.container.appendChild(div);
    }

    calculateOverlaps(blocks) {
        blocks.forEach(block => block._level = 0);
        for (let i = 0; i < blocks.length; i++) {
            for (let j = 0; j < i; j++) {
                if (blocks[i].start < blocks[j].end) {
                    if (blocks[i]._level <= blocks[j]._level) {
                        blocks[i]._level = blocks[j]._level + 1;
                    }
                }
            }
        }
        return blocks;
    }

    drawBlock(block) {
        const div = document.createElement('div');
        div.className = 'time-block';
        
        const top = block.start * this.pixelsPerMinute;
        const duration = block.end - block.start;
        const height = duration * this.pixelsPerMinute;

        const leftOffset = 60 + (block._level * 20); 
        const widthCalc = `calc(100% - ${leftOffset + 10}px)`;

        div.style.top = `${top}px`;
        div.style.height = `${Math.max(height, 25)}px`; 
        div.style.left = `${leftOffset}px`;
        div.style.width = widthCalc;
        div.style.zIndex = 10 + block._level;

        div.dataset.id = block.id;

        if(block.type === 'WASTE') div.classList.add('block-waste');
        else div.classList.add('block-invest');

        // --- SISTEMA DE EMOJIS CORREGIDO ---
        let badgeHtml = '';
        if (block.decision === 'delete') {
            badgeHtml = `<span style="position:absolute; top:2px; right:5px; font-size:0.9rem;">🗑️</span>`;
        } else if (block.decision === 'delegate') {
            badgeHtml = `<span style="position:absolute; top:2px; right:5px; font-size:0.9rem;">🤝</span>`;
        } else if (block.decision === 'automate') {
            badgeHtml = `<span style="position:absolute; top:2px; right:5px; font-size:0.9rem;">⚙️</span>`;
        } else if (block.decision === 'routine') {
            // NUEVO: Ahora las Rocas Grandes tienen su propio icono
            badgeHtml = `<span style="position:absolute; top:2px; right:5px; font-size:0.9rem;">🔄</span>`;
        } else {
            // Tarea sin auditar (El Juez te espera)
            badgeHtml = `<span style="position:absolute; top:4px; right:4px; font-size:0.75rem; background: rgba(0,0,0,0.5); border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; animation: pulse-gap 2s infinite;">⚠️</span>`;
        }

        div.innerHTML = `
            ${badgeHtml}
            <div class="block-content">
                <strong>${block.label}</strong>
                <small>${duration} min</small>
            </div>
        `;
        this.container.appendChild(div);
    }

    renderNowLine() {
        const line = document.createElement('div');
        line.className = 'now-line';
        this.container.appendChild(line);
        const update = () => {
            const mins = TimeUtils.getCurrentDayMinutes();
            line.style.top = `${mins * this.pixelsPerMinute}px`;
        };
        update();
        setInterval(update, 60000); 
    }
}