// # Arc
// ### A microservice manager
// ![gif](https://media.giphy.com/media/kFyLfPH7FU7zW/giphy.gif)

// Arc loads node modules it depends to operate
const { dotenv } = require(`./dependencies`);

// Arc adds the `.env file` variables to the process
dotenv.config();

// Arc loads paperboy for intersystem communication
const Paperboy = require(`paperboy-communicator`);
const paperboy = new Paperboy({connectionName: `arc`});

// Arc updates the process title
process.title = `@/_arc-${process.title}`;

// Arc loads support modules
const checkManifest         = require(`./support/check_manifest`);
const messageParser         = require(`./support/message_parser`)({paperboy});
const createWorkerPool      = require(`./support/create_worker_pool`)({paperboy});
const createMicroservices   = require(`./support/microservice_creator`);
const setMicroserviceEvents = require(`./support/microservice_event_setter`)({paperboy});
const monitor               = require(`./support/monitor`);

// Arc creates a global variable to store a reference to microservices
let allMicroservices = {};

// Arc can use a global function to get all microservices
const getAllMicroservices = () => allMicroservices;

// Arc can parse messages using the message parser support module
const parseMessage = (options) => messageParser(getAllMicroservices(), options);

// Arc can create a microservice worker pool
const workerPool = (options) => createWorkerPool(parseMessage, options);

// Arc can shutdown microservices
const shutdownMicroservices = require(`./support/shutdown_microservices`)({paperboy});

// #### Arc can create pools of microservices
module.exports = (microserviceManifest, options = {}) => {

  // Arc monitors activitiy
  if(options.monitor != false) {
    monitor({paperboy});
  }

  return new Promise((resolve, reject) => {
    void async function(){
      try {
        // **Given** Arc checks the manifest file to see if it has any errors
        const parsedManifest = await checkManifest(microserviceManifest);

        // **And** Arc creates microservices
        allMicroservices    = await createMicroservices(workerPool, parsedManifest);

        // **And** Arc sets the intersystem communication events for microservies it created
        await setMicroserviceEvents(allMicroservices);

        // **And** Arc waits for extensions to do their thing
        await Promise.all(module.exports._extensions.map(({extension, options}) => {
          return new Promise((resolve) => {
            resolve(extension({paperboy, microservices: allMicroservices, options}));
          });
        }));

        // **And** Arc uses paperboy to let the system know about microservices that are online
        allMicroservices.forEach((microservice) => {
          paperboy.trigger(`@health`, JSON.stringify({
            title: microservice.title,
            metrics: {status: `online`},
            pid: process.pid
          }));
        });

        // **Then** Arc returns the microservices it created
        resolve(allMicroservices);
      } catch (error) {

        // **But** Arc returns an error message when something goes wrong
        reject(error);
      }
    }();
  });
};

// Arc adds the steps it uses to the exported module
// > this is only for testing what Arc can do
module.exports._steps = {
  checkManifest, parseMessage, workerPool,
  createMicroservices, setMicroserviceEvents, getAllMicroservices
};

// Arc can shutdown the microservices it created
module.exports.shutdownMicroservices = () => shutdownMicroservices(getAllMicroservices());

// Arc can be extended
module.exports._extensions = [];
module.exports.addExtension = (extension, options = {}) => {
  if(typeof extension != `function`) throw Error(`Arc extension must be a function or a promise`);
  module.exports._extensions.push({extension, options});
};

// Arc adds a reference to paperboy
module.exports.paperboy = paperboy;