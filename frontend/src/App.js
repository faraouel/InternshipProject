import './App.css';
import React from 'react';
import SoundBuffer from './SoundBuffer';
import io from "socket.io-client";
import RecordRTC from "recordrtc"

const CHUNK_SIZE = 1000; // ms
const BUFFER_SIZE = 2; // chunks in queue before playing

const context = new AudioContext();

export default class App extends React.Component {
  constructor() {
    super();
    this.chunk_size = CHUNK_SIZE;

    this.state = {showRecorder: false, socket: null, socketConnected: false, transcription: ""};
    this.startRecording = this.startRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this.chunkProcessed = this.chunkProcessed.bind(this);
    this.addAudioChunk = this.addAudioChunk.bind(this);
    this.endAudioTransmit = this.endAudioTransmit.bind(this);

    this.audioChunks = new ArrayBuffer();

    // this.

    // this.buffer = new SoundBuffer(this.context, this.context.sampleRate, BUFFER_SIZE);
    this.setupRecorder();    
    
  }

  componentDidMount() {
    let socket = io('http://localhost:8000');
    this.setState(() => {return {socket: socket}});

    socket.on('processed', this.chunkProcessed);
    socket.on('tts-audio', this.addAudioChunk);
    socket.on('end-audio-transmit', this.endAudioTransmit)
  }

  componentDidUpdate() {
    if (!this.state.socket) return;
 
    this.state.socket.on('connect', () => {
      this.setState(() => {return {socketConnected: this.state.socket.connected}});
    });
    this.state.socket.on('disconnect', () => {
      this.setState(() => {return {socketConnected: this.state.socket.connected}});
    });
    
  }

  chunkProcessed(data) {
    console.log(data);
    this.setState((_) => {
      return {transcription: data};
    });
  }

  addAudioChunk(data) {

    this.audioChunks = this.appendBuffer(this.audioChunks, data);
  }

  async setupRecorder() {
    this.stream_ = await this.getUserMedia();
    const options = {
      type: 'audio',
      mimeType: 'audio/mp3',
      numberOfAudioChannels: 1,
      recorderType: RecordRTC.StereoAudioRecorder,
      checkForInactiveTracks: true,
      timeSlice: this.chunk_size,
      ondataavailable: (blob) => {
        this.sendData(blob);
        console.log(blob)
      },
    }

    this.recorder = new RecordRTC(this.stream_, options)
  }

  async sendData(chunk) {
    if (!this.state.socketConnected) return;

    this.state.socket.emit('chunk', chunk);
  }

  appendBuffer(buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
  };

  async endAudioTransmit(evt) {
    console.log(this.audioChunks)
    var newSource = context.createBufferSource();
    var newBuffer = context.createBuffer( 1, this.audioChunks.byteLength, 22000 );
    newBuffer = await context.decodeAudioData(this.audioChunks);
    newSource.buffer = newBuffer;

    newSource.connect( context.destination );
    newSource.start(0);
  }

  
  async getUserMedia() {
    return new Promise((resolve, reject) => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            console.log("getUserMedia supported.");
            navigator.mediaDevices
                .getUserMedia({audio: true})
                .then((stream) => { resolve(stream); })
                .catch((err) => { console.error(`The following getUserMedia error occurred: ${err}`); });
        } else {
            console.log("getUserMedia not supported on your browser!");
        }
    });
  }

  startRecording(e) {
    if (!this.state.socketConnected) return;
    let settings = this.stream_.getAudioTracks()[0].getSettings()
    console.log(settings)
    this.state.socket.emit('start', { 'sampleRate' : settings['sampleRate'],
                                      'sampleSize' : settings['sampleSize']
    });

    this.setState((_) => {
      return {showRecorder: true};
    });

    this.recorder.startRecording()
  }

  stopRecording(e) {
    this.setState((_) => {
      return {showRecorder: false};
    });
    this.recorder.stopRecording();

    if (!this.state.socketConnected) return;

    this.state.socket.emit('end', true);
  }

  render() {
    return (
      <div className="App">
        <div>
          <b>Connection status:</b> {this.state.socketConnected ? 'Connected' : 'Disconnected'}
        </div>
        {this.state.showRecorder && <div className='recorder'>
          
          <div>

            <div className="circle" style={{animationDelay: '0s'}}></div>
            <div className="circle" style={{animationDelay: '1s'}}></div>
            <div className="circle" style={{animationDelay: '2s'}}></div>
            <div className="circle" style={{animationDelay: '3s'}}></div>

            <button className="record" onClick={this.stopRecording}>Stop Recording</button>

            <div>{this.state.transcription}</div>

          </div>

        </div>}
        {!this.state.showRecorder &&
        <button className="record" onClick={this.startRecording}>Record</button>}
      </div>
    );
  }
}