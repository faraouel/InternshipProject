from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import whisper
from TTS.api import TTS
from wav_creator import get_wav_data
from tempfile import NamedTemporaryFile
from multiprocessing import Process, Manager, set_start_method
from miniaudio import SampleFormat, decode
import os
import torch
from pydub import AudioSegment
import gc

# in CMD run "C:\Users\USERNAME\Anaconda3\Scripts\activate"
# run "python -m flask run" from directory

HEADER_SIZE = 64
CHUNK_SIZE = 16


class Processing:
    def __init__(self):
        self.stt_model = whisper.load_model("base.en")
        # List available 🐸TTS models
        self.tts_model = TTS.list_models()[11]  # 8 is fine
        print(TTS.list_models())
        self.tts = TTS(self.tts_model)
        self.buffer = bytes()
        self.temp_file = NamedTemporaryFile().name
        self.temp_tts_output = NamedTemporaryFile().name
        self.sampleRate = 48000
        self.sampleWidth = 2
        self.result = False
        self.stop = False
        self.transcribe_queue = []

    def chunk_handling(self, data):
        if len(self.transcribe_queue) == 0:
            self.transcribe_queue.append(data)
            self.runQueue()
        else:
            self.transcribe_queue.append(data)

    def runQueue(self):
        while len(self.transcribe_queue) != 0 and not self.stop:
            print("Queue Start")
            chunk = self.transcribe_queue[0]
            self.buffer += chunk[44:]

            output = get_wav_data(self.buffer, self.sampleRate, self.sampleWidth).read()
            with open(self.temp_file, "wb") as f:
                f.write(output)

            self.result = self.stt_model.transcribe(self.temp_file, fp16=False)
            emit("processed", self.result["text"])
            print("Queue End")
            self.transcribe_queue.pop(0)
        if self.stop:
            self.transcribe_queue = []

    def tts_(self, text):
        self.tts.tts_to_file(text=str(text), file_path=self.temp_tts_output)
        gc.collect()
        self.streamAudio()

    def streamAudio(self):
        with open(self.temp_tts_output, "rb") as f:
            # header = f.read(HEADER_SIZE)
            data = f.read(CHUNK_SIZE * 1024)
            while data:
                emit("tts-audio", data)
                data = f.read(CHUNK_SIZE * 1024)
            emit("end-audio-transmit", True)

    def end_recording(self):
        self.buffer = bytes()
        self.result["text"] = ""
        del self.stt_model.encoder
        del self.stt_model.decoder
        del self.stt_model
        torch.cuda.empty_cache()


app = Flask(__name__)
process = Processing()
app.config["SECRET_KEY"] = "secret!"
socketio = SocketIO(app, cors_allowed_origins="*")


@socketio.on("chunk")
def test_connect(data):
    print("chunk received")
    processed_data = process.chunk_handling(data)
    gc.collect()


@socketio.on("start")
def starting(data):
    print(torch.__version__)
    process.stt_model = whisper.load_model("tiny.en")
    process.stt_model = process.stt_model.to("cuda")
    process.stop = False
    process.sampleRate = data["sampleRate"]
    process.sampleWidth = int(data["sampleSize"] / 8)
    print("starting recording")


@socketio.on("end")
def ending(data):
    print("ending recording")
    process.stop = True
    process.tts_(process.result["text"])
    process.end_recording()
    gc.collect()
    buffer = []


if __name__ == "__main__":
    socketio.run(app, port=8000)
