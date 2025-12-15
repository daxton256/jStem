
/*
 * StemPlayer class
 * Designed with the Web Audio API for sample-accurate stem syncing,
 * per-stem volume control, scrubbing, and playback-rate changes
 * without browser desync.
 *
 * Authored by ChatGPT (OpenAI) — yeah, the AI did the hard part.
 * If this breaks, you probably touched something you shouldn’t have.
 */


class StemPlayer {
    constructor() {
        this.context = new AudioContext();
        this.buffers = [];
        this.gainNodes = [];
        this.sources = [];
        this.offset = 0;
        this.startTime = 0;
        this.playbackRate = 1;
    }

    async loadStems(stemFiles) {
        // Stop and clear old stems if any
        this.stop();
        this.buffers = [];
        this.gainNodes = [];
        this.sources = [];
        this.offset = 0;

        // Load and decode all new stems
        this.buffers = await Promise.all(stemFiles.map(async file => {
            const arrayBuffer = await file.arrayBuffer();
            return await this.context.decodeAudioData(arrayBuffer);
        }));

        // Create gain nodes for volume control
        this.gainNodes = this.buffers.map(() => {
            const gain = this.context.createGain();
            gain.connect(this.context.destination);
            return gain;
        });
    }

    play() {
        if (!this.buffers.length) return;

        this.startTime = this.context.currentTime;
        this.sources = this.buffers.map((buffer, i) => {
            const source = this.context.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = this.playbackRate;
            source.connect(this.gainNodes[i]);
            source.start(this.startTime, this.offset);
            return source;
        });
    }

    pause() {
        if (!this.sources.length) return;
        this.offset += (this.context.currentTime - this.startTime) * this.playbackRate;
        this.sources.forEach(source => source.stop());
        this.sources = [];
    }

    seek(time) {
        this.offset = time;
        this.pause();
        this.play();
    }

    setPlaybackRate(rate) {
        this.playbackRate = rate;
        this.pause();
        this.play();
    }

    setStemVolume(stemIndex, value) {
        if (this.gainNodes[stemIndex]) {
            this.gainNodes[stemIndex].gain.value = value;
        }
    }

    stop() {
        this.sources.forEach(source => source.stop?.());
        this.sources = [];
    }
}
