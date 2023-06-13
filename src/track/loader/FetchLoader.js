import Loader from "./Loader";

function appendBuffer(buffer1, buffer2) {
  var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
  return tmp.buffer;
}

export default class extends Loader {
  scheduleBuffers() {
    while (this.audioStack.length) {
      var buffer = this.audioStack.shift();
      this.audioBuffer = appendBuffer(this.audioBuffer, buffer);
    }
  }

  /**
   * Loads an audio file via fetch API.
   */
  load() {
    return new Promise(
      function (resolve, reject) {
        fetch(this.src)
          .then(
            function (response) {
              var reader = response.body.getReader();
              var header = null; //first 44bytes

              this.setStateDecoding();

              function read() {
                return reader.read().then(
                  function ({ value, done }) {
                    var audioBuffer = null;

                    if (header == null) {
                      //copy first 44 bytes (wav header)
                      header = value.buffer.slice(0, 44);
                      audioBuffer = value.buffer;
                    } else {
                      audioBuffer = appendBuffer(header, value.buffer);
                    }

                    this.ac.decodeAudioData(
                      audioBuffer,
                      function (buffer) {
                        this.audioStack.push(buffer);
                        if (this.audioStack.length) {
                          scheduleBuffers();
                        }
                      }.bind(this),
                      (err) => {
                        if (err === null) {
                          // Safari issues with null error
                          throw Error("MediaDecodeAudioDataUnknownContentType");
                        } else {
                          throw err;
                        }
                      }
                    );

                    if (done) {
                      this.setStateFinished();
                      console.log("done: fetch API stream");
                      return;
                    }

                    //read next buffer
                    read();
                  }.bind(this)
                );
              }

              read();
            }.bind(this)
          )
          .catch(
            function (err) {
              reject(
                Error(`Track ${this.src} failed to load with error: ${err}`)
              );
            }.bind(this)
          );
      }.bind(this)
    );
  }
}
