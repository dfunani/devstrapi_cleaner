const file = require("fs");
require("dotenv").config();
const axios = require("axios");

class MessageQueue {
  filename = "./queue.txt";
  constructor(strapiUpdateServer = process.env.STRAPI_UPDATER_SERVER) {
    this.STRAPI_UPDATER_SERVER = strapiUpdateServer;
    if (file.existsSync(this.filename)) {
      this.queue = JSON.parse(file.readFileSync(this.filename));
    } else {
      this.queue = [];
    }
  }

  add(queueItem) {
    if (typeof queueItem === "object")
      try {
        this.queue = [...this.queue, ...queueItem.data];
      } catch (error) {
        console.log("Requested Queue Item could not be added", error);
      }
  }
  async process() {
    this.read();
    this.queue.forEach(async (item) => {
      const poppedItem = this.queue.pop();
      try {
        const result = await axios.post(this.strapiUpdateServer, {
          data: poppedItem,
        });
        if (result.status === 200) {
          console.log(result.data);
        } else {
          this.queue.push(item);
        }
      } catch (error) {
        this.queue.push(item);
        console.log("Queue Item could not be process", error);
      }
    });
  }

  persist() {
    file.writeFile(this.filename, JSON.stringify(this.queue), () => {
      console.log("Queue persisted");
    });
  }

  read() {
    file.readFile(this.filename, (err, data) => {
      if (err) {
        this.queue = [];
      } else {
        try {
          this.queue = JSON.parse(data);
        } catch (err) {
          this.queue = [];
        }
      }
    });
  }
}

class Strapi {
  constructor(
    strapiURL = process.env.STRAPI_URL,
    strapiEndpoint = process.env.STRAPI_ENDPOINT
  ) {
    this.strapiURL = strapiURL;
    this.strapiEndpoint = strapiEndpoint;
  }

  async fetchOne(id) {
    try {
      const result = await axios.get(this.strapiURL + this.strapiEndpoint + id);
      return {
        status: "SUCCESS",
        message: "Fetched One Item Without Issue",
        result: result.data,
      };
    } catch (error) {
      return {
        status: "ERROR",
        message: error,
        result: null,
      };
    }
  }

  async fetchMany() {
    try {
      const result = await axios.get(this.strapiURL + this.strapiEndpoint);
      return {
        status: "SUCCESS",
        message: "Fetched One Item Without Issue",
        result: result.data,
      };
    } catch (error) {
      return {
        status: "ERROR",
        message: error,
        result: null,
      };
    }
  }
}

const strapi = new Strapi();
const queue = new MessageQueue();
strapi.fetchMany().then((app) => {
  if (app.status === "SUCCESS") {
    queue.add(app.result);
    queue.persist();
    queue.process();
  }
});
