
export default class SoundBuffer {

    constructor(ctx, sampleRate, bufferSize = 4) {
        this.chunks = [];

        this.first_chunk_dur = 0;
        this.first_chunk = undefined;

        this.initialized = false;

        this.isPlaying = false;
        this.startTime = 0;
        this.lastChunkOffset = 0;

        this.ctx = ctx;
        this.sampleRate = sampleRate;
        this.bufferSize = bufferSize;

    }

    async startChunk(chunk, delay) {
        console.log("playing")
        var source = this.ctx.createBufferSource();
        var newBuffer;
        var offset;

        // if (this.initialized) {
        //     newBuffer = this.ctx.createBuffer( 1, /* this.first_chunk.byteLength + */ chunk.byteLength, this.ctx.sampleRate );
        //     newBuffer = await this.ctx.decodeAudioData(chunk); //this.appendBuffer(this.first_chunk, chunk));
        //     // offset = 0; //this.first_chunk_dur;
        // } else {
        //     this.first_chunk = chunk.slice(0);
        newBuffer = this.ctx.createBuffer( 1, chunk.byteLength, this.ctx.sampleRate );
        newBuffer = await this.ctx.decodeAudioData(chunk);
        this.initialized = true;
        // this.first_chunk_dur = newBuffer.duration;

        //     // offset = 0;
        // }
        

        source.buffer = newBuffer;

        source.connect( this.ctx.destination );

        source.onended = (e) => {
            this.chunks.splice(this.chunks.indexOf(chunk),1);
            if (this.chunks.length === 0) {
                this.isPlaying = false;
                this.startTime = 0;
                this.lastChunkOffset = 0;
            }
        };

        console.log(delay);
        source.start(delay);
        console.log(source.buffer.duration);

        return source;

    } 

    async addChunk(data) {
        if (!this.isPlaying) {  // add & don't schedule
            this.isPlaying = true;
            this.startTime = this.ctx.currentTime;
            this.lastChunkOffset = 0;
            let source = await this.startChunk(data, this.startTime + this.lastChunkOffset);
            this.lastChunkOffset += source.buffer.duration;
            console.log("add no play")
        } else  { // add & schedule entire buffer

            console.log("start")
            let source = await this.startChunk(data, this.startTime + this.lastChunkOffset);
            this.lastChunkOffset += source.buffer.duration;
        }
    }
}