import { TimeUtils } from '../utils/timeUtils.js';

export class TimeStack {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.pixelsPerMinute = 2; // ESCALA: 2px por minuto = 2880px total
    }

    render(blocks) {
        // 1. Limpieza
        this.container.innerHTML = ''; 
        
        // 2. CRÍTICO: Establecer la altura real del scroll
        // Esto fuerza al navegador a dibujar un área scrollable larga
        this.container.style.height = `${1440 * this.pixelsPerMinute}px`;

        // 3. Dibujar Grilla (Horas)
        this.renderGrid();
        
        const safeBlocks = Array.isArray(blocks) ? blocks : [];
        let sorted = safeBlocks.sort((a, b) => a.start - b.start);

        // 4. Dibujar Vacíos
        this.renderGaps(sorted);

        // 5. Dibujar Bloques (Con lógica de cascada para no solapar)
        sorted = this.calculateOverlaps(sorted);
        sorted.forEach(block => this.drawBlock(block));

        // 6. Línea de Tiempo
        this.renderNowLine();
    }

    renderGrid() {
        for (let i = 0; i < 24; i++) {
            const yPos = (i * 60) * this.pixelsPerMinute;
            const marker = document.createElement('div');
            marker.className = 'hour-marker';
            // Posicionamiento explícito
            marker.style.top = `${yPos}px`;
            marker.innerHTML = `<span>${i.toString().padStart(2, '0')}:00</span>`;
            this.container.appendChild(marker);
        }
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
        
        // Cálculos matemáticos de posición
        const top = block.start * this.pixelsPerMinute;
        const duration = block.end - block.start;
        const height = duration * this.pixelsPerMinute;

        // Cascada
        const leftOffset = 60 + (block._level * 20); 
        const widthCalc = `calc(100% - ${leftOffset + 10}px)`;

        // APLICAR ESTILOS INLINE (La clave del calendario)
        div.style.top = `${top}px`;
        div.style.height = `${Math.max(height, 25)}px`; // Mínimo 25px para que se vea texto
        div.style.left = `${leftOffset}px`;
        div.style.width = widthCalc;
        div.style.zIndex = 10 + block._level;

        div.dataset.id = block.id;

        if(block.type === 'WASTE') div.classList.add('block-waste');
        else div.classList.add('block-invest');

        div.innerHTML = `
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