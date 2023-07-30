const file = require("fs");
require("dotenv").config();
const axios = require("axios");

//
class MessageQueue {
  filename = "./queue.txt";
  queue = {
    unprocessed: [],
    processed: [],
  };
  constructor(strapiUpdateServer = process.env.STRAPI_UPDATER_SERVER) {
    this.strapiUpdateServer = strapiUpdateServer;
    this.read();
  }

  add(queueItem) {
    if (typeof queueItem === "object") {
      this.queue = {
        processed: [...this.queue.processed],
        unprocessed: [
          ...queueItem.filter(
            (item) =>
              !this.queue.processed
                .map((processed) => processed.id)
                .includes(item.id)
          ),
        ],
      };
      console.log(
        "Unprocessed MicroApps - " +
          this.queue.unprocessed.length +
          " Processed MicroApps - " +
          this.queue.processed.length
      );
    }
  }

  process() {
    const unprocessed = [...this.queue.unprocessed];
    unprocessed.forEach((temp, index) => {
      const poppedItem = this.queue.unprocessed.pop();
      axios
        .post(
          this.strapiUpdateServer,
          {
            ...poppedItem
          },
          {
            headers: { "Content-Type": "application/json", Accept: "*/*" },
          }
        )
        .then((result) => {
          if (result.status === 200) {
            this.queue.processed.push(poppedItem);
            console.log("Processed MicroApp: " + poppedItem.id)
          } else {
            this.queue.unprocessed.unshift(poppedItem);
            console.log("Unprocessed MicroApp: " + poppedItem.id)
          }
          console.log(
            "Unprocessed MicroApps - " +
              this.queue.unprocessed.length +
              " Processed MicroApps - " +
              this.queue.processed.length
          );
          this.persist();
        })
        .catch((error) => {
          this.queue.unprocessed.unshift(poppedItem);
          console.log("Unprocessed MicroApp: " + poppedItem.id)
          console.log(
            "Unprocessed MicroApps - " +
              this.queue.unprocessed.length +
              " Processed MicroApps - " +
              this.queue.processed.length
          );

          this.persist();
        });
    });
  }

  persist() {
    file.writeFile(
      this.filename,
      JSON.stringify(this.queue, null, 2),
      (err) => {
        if (err) {
          console.log(err);
        }
      }
    );
  }

  read() {
    file.readFile(this.filename, (err, data) => {
      if (err) {
        console.log("No File To Read");
      } else {
        try {
          this.queue = JSON.parse(data);
        } catch (error) {
          this.queue = {
            unprocessed: [],
            processed: [],
          };
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
      const result = await axios.get(
        this.strapiURL + this.strapiEndpoint + id + "/" + process.env.FILTERS
      );
      return {
        status: "SUCCESS",
        message: `Total MicroApps Fectched: ${result.data.data.length}`,
        result: result.data.data.length,
      };
    } catch (error) {
      return {
        status: "ERROR",
        message: `Total MicroApps Fectched: 0`,
        result: error,
      };
    }
  }

  async fetchMany() {
    let page = 1;
    try {
      let temp = await axios.get(
        this.strapiURL +
          this.strapiEndpoint +
          process.env.FILTERS +
          "&pagination[page]=" +
          page.toString()
      );

      const result = temp;
      while (page <= parseInt(result.data.meta.pagination.pageCount)) {
        page++;
        temp = await axios.get(
          this.strapiURL +
            this.strapiEndpoint +
            process.env.FILTERS +
            "&pagination[page]=" +
            page.toString()
        );
        result.data.data = [...result.data.data, ...temp.data.data];
      }
      return {
        status: "SUCCESS",
        message: `Total MicroApps Fetched: ${result.data.data.length}`,
        result: result.data.data,
      };
    } catch (error) {
      return {
        status: "ERROR",
        message: `Total MicroApps Fetched: 0`,
        result: error,
      };
    }
  }
}

const strapi = new Strapi();
const queue = new MessageQueue();
strapi.fetchMany().then((app) => {
  if (app.status === "SUCCESS") {
    queue.add(app.result);
    queue.process();
  }
});
