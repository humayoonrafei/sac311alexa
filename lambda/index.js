/* *
 * 🚨 This is the main file for the Sacramento 311 Alexa Skill 📞
 * Written by Andy Chung, Rayman Thandi, Ronald Her, Mico Barcelona, Alexa Carrell, Ethan Borg, 
 * Humayoon Rafei, and Justin Heyman
 * Dinosaur Game 💪
 * */

// TODO: Prevent the reflector handler from being triggered if it is a yes/no
// intent and instead direct it to the fallback intent

//  TODO: Create "anythingElse?" YesNo intents to handle the "anything else?" question


const Alexa = require("ask-sdk")
const AWS = require("aws-sdk")
const dynamoDbPersistenceAdapter = require("ask-sdk-dynamodb-persistence-adapter")
const i18n = require("i18next")
var axios = require("axios")

// Creating the local dynamoDB client for development
// You will need to install dynamoDB locally and run it on port 8000
// https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html#DynamoDBLocal.DownloadingAndRunning.title

// TODO: set up different client for alexa-hosted environment contingent on environment variables
const localDynamoDBClient = new AWS.DynamoDB(
  { apiVersion: "latest",
    region: "us-west-2",
    endpoint: "http://localhost:8000",
    accessKeyId: 'fakeMyKeyId',
    secretAccessKey: 'fakeSecretAccessKey' 
  }
);

const languageStrings = require("./ns-common.json")
const strayAnimal = require("./strayAnimal.js")
const abandonedVehicle = require("./abandoned-vehicle.js")
const potHole = require("./pothole.js")
const petcomplaint = require("./petcomplaint.js")
const homelessCamp = require("./homeless-encampment.js")
const getLocation = require("./getLocation")
const dirtyBathroom = require("./dirty-bathroom.js")
const trashpickup = require("./trash-pickup.js")
const liveAgent = require("./liveAgent.js")


// Stows the asked question in a session attribute for yes and no intent handlers
function setQuestion(handlerInput, questionAsked) {
  const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
  sessionAttributes.questionAsked = questionAsked;
  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    )
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    if (sessionAttributes.userFullName) {
      return (
        handlerInput.responseBuilder
          .speak(handlerInput.t('PERSONALIZED_WELCOME_MSG', { name: sessionAttributes.userFullName })) // TODO: Trim last name
          .reprompt(handlerInput.t('WELCOME_REPROMPT'))
          .getResponse()
      )
    } else {
      return (
        handlerInput.responseBuilder
          .speak(handlerInput.t('WELCOME_MSG'))
          .reprompt(handlerInput.t('WELCOME_REPROMPT'))
          .getResponse()
      )
    }
  }
}

const ReportAnIssueIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ReportAnIssueIntent'
    )
  },
  handle(handlerInput) {
    setQuestion(handlerInput, null)
    return (
      handlerInput.responseBuilder
        .speak(handlerInput.t('REPORT_ISSUE'))
        .withShouldEndSession(false) // keep the session open
        .getResponse()
    )
  }
}


// If the user wishes to try rephrasing their intent
const YesRetryIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent'
      && handlerInput.attributesManager.getSessionAttributes().questionAsked === 'TryAgain'
    )
  },
  handle(handlerInput) {
    setQuestion(handlerInput, null) // Remember to clear the questionAsked field for other y/n questions in same session
    return (
      handlerInput.responseBuilder
        .speak(handlerInput.t('YES_RETRY'))
        .withShouldEndSession(false)
        .getResponse()
    )
  }
}


// If the user does not wish to try rephrasing their intent.
const NoRetryIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent'
      && handlerInput.attributesManager.getSessionAttributes().questionAsked === 'TryAgain'
    )
  },
  handle(handlerInput) {
    setQuestion(handlerInput, null)
    return (
      handlerInput.responseBuilder
        .speak(handlerInput.t('NO_RETRY'))
        .withShouldEndSession(true) // This will end the session
        .getResponse()
    )
  },
}

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    )
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(handlerInput.t('HELP_MSG'))
      .reprompt(handlerInput.t('HELP_MSG'))
      .getResponse()
  },
}

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.StopIntent")
    )
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak(handlerInput.t('GOODBYE_MSG')).getResponse()
  },
}
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to
 * any intents in your skill It must also be defined in the language model (if
 * the locale supports it) This handler can be safely added but will be
 * ingnored in locales that do not support it yet
 * */
const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
      "AMAZON.FallbackIntent"
    )
  },
  // TODO: Add sessionattributes counter for fallbacks. If 3 fallbacks then
  // offer to send to live agent or end the session.
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes()

    if (!sessionAttributes.fallbackCount) {
      sessionAttributes.fallbackCount = 1
    } else {
      sessionAttributes.fallbackCount++
      if (sessionAttributes.fallbackCount >= 3) {
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes)
        return handlerInput.responseBuilder
          .speak(handlerInput.t('FALLBACK_STILL_MSG'))
          .reprompt(handlerInput.t('FALLBACK_STILL_MSG_REPROMPT'))
          .getResponse()
      }
    }

    handlerInput.attributesManager.setSessionAttributes(sessionAttributes)
    return handlerInput.responseBuilder
      .speak(handlerInput.t('FALLBACK_MSG'))
      .reprompt(handlerInput.t('FALLBACK_MSG_REPROMPT'))
      .getResponse()
  },
}
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs
 * */
const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      "SessionEndedRequest"
    )
  },
  async handle(handlerInput) {
    // console.log(
    //   `~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`
    // )
    // Any cleanup logic goes here.
    console.log("Session ended")

    return handlerInput.responseBuilder
      .getResponse(); // notice we send an empty response
  },
}


/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents
 * by defining them above, then also adding them to the request handler chain below
 * */
const IntentReflectorHandler = {
  //not set up with i18n
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
    )
  },
  handle(handlerInput) {
    const intentName = Alexa.getIntentName(handlerInput.requestEnvelope)
    const speakOutput = `You just triggered ${intentName}`

    return (
      handlerInput.responseBuilder
        .speak(speakOutput)
        //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
        .getResponse()
    )
  },
}


/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below
 * */
const ErrorHandler = {
  canHandle() {
    return true
  },
  handle(handlerInput, error) {
    console.log(`~~~~ Error handled ~~~~`)
    console.log(error)

    return handlerInput.responseBuilder
      .speak(handlerInput.t('ERROR_MSG'))
      .reprompt(handlerInput.t('ERROR_MSG'))
      .getResponse()
  },
}


// TODO: Create an interceptor that checks if the current intent has empty
// slots that can be filled from sessionAttributes
const ContextSwitchingRequestInterceptor = {
  process(handlerInput) {
    const { requestEnvelope, attributesManager } = handlerInput
    const currentIntent = requestEnvelope.request.intent

    if (requestEnvelope.request.type === 'IntentRequest'
      && requestEnvelope.request.dialogState !== 'COMPLETED') {
      const sessionAttributes = attributesManager.getSessionAttributes();

      // If there are no session attributes we've never entered dialog
      // management for this intent before 
      if (sessionAttributes[currentIntent.name]) {
        let savedSlots = sessionAttributes[currentIntent.name].slots

        for (let key in savedSlots) {
          // The current intent's slot values take precedence over saved slots
          if (!currentIntent.slots[key].value && savedSlots[key].value) {
            currentIntent.slots[key] = savedSlots[key]
          }
        }
      }

      sessionAttributes[currentIntent.name] = currentIntent
      attributesManager.setSessionAttributes(sessionAttributes)
    }
  }
}

//TODO: Probably don't get the address unless we need to.
const NewSessionRequestInterceptor = {
  async process(handlerInput) {
    // console.log('request:', JSON.stringify(handlerInput.requestEnvelope.request));



    if (handlerInput.requestEnvelope.session.new) {



      const { attributesManager } = handlerInput;
      const attributes = await attributesManager.getPersistentAttributes() || {};



    }
  }
}

// Not sure this is ever needed since we should always just send the delegate slots from the session attributes?
const DelegateDirectiveResponseInterceptor = {
  process(handlerInput, response) {
    // If there is a delegate directive in the response, replace it with any
    // saved slots for the intent being delegated
    console.log(response)


    // If the response has dialog delegate directives, add any existing slots from session attributes
    if (response.directives && response.directives[0].updatedIntent && response.directives[0].type === 'Dialog.Delegate') {
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes()
      // const currentIntent = handlerInput.requestEnvelope.request.intent
      const delegatedIntent = response.directives[0].updatedIntent
      if (sessionAttributes[delegatedIntent.name]) {
        let savedSlots = sessionAttributes[delegatedIntent.name].slots
        for (let key in savedSlots) {
          if (!response.directives[0].updatedIntent.slots[key].value && savedSlots[key].value) {
            response.directives[0].updatedIntent.slots[key] = savedSlots[key]
          }
        }
      }
      console.log(response)
    }
  }
}

const LocalisationRequestInterceptor = {
  //add new Strings and keys to ns-common.json
  process(handlerInput) {
      i18n.init({
          lng: Alexa.getLocale(handlerInput.requestEnvelope),
          fallbackLng: 'en',
          resources: languageStrings
      }).then((t) => {
          handlerInput.t = (...args) => t(...args);
      });
      //i18n.changeLanguage('es'); //use statement to test fallbackLng and spanish functionality
  }
}

const PersonalizationRequestInterceptor = {
  async process(handlerInput) {
    if (Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest") {
      const { attributesManager, requestEnvelope } = handlerInput
      const {apiAccessToken} = requestEnvelope.context.System ? requestEnvelope.context.System : null;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};
      let persistentAttributes = await attributesManager.getPersistentAttributes() || {};
      console.log('persistentAttributes: ' + JSON.stringify(persistentAttributes));
      const userFullName = persistentAttributes.hasOwnProperty('userFullName') ? persistentAttributes.userFullName : null;
      console.log('userFullName: ' + userFullName)

      // If no full name was in persistent attributes, get it from the API
      if (!userFullName) {

      // Axios config to set headers
        let config = {
          headers: {
            'Authorization': `Bearer ${apiAccessToken}`
          }
        }

        try {
          res = await axios.get(
          'https://api.amazonalexa.com/v2/accounts/~current/settings/Profile.name',
          config
        )
        } catch (error) {
          console.log("There was a problem getting the user's name") 
          console.log(error)
        }

        if (res.status === 200) {
          persistentAttributes = {"userFullName":res.data}
          attributesManager.setPersistentAttributes(persistentAttributes)  // Pay attention to these two lines: set 
          await attributesManager.savePersistentAttributes()                // and then save
        } else {
          console.log("There was a problem getting the user's name") 
          console.log(res)
        }

      } else {  // Else, if there was a full name in persistent attributes, set it in session attributes  
        sessionAttributes.userFullName = userFullName
        attributesManager.setSessionAttributes(sessionAttributes)
      }
    }
  }
}

// Stores the asked question in a session attribute for yes and no intent handlers
function setQuestion(handlerInput, questionAsked) {
  const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
  sessionAttributes.questionAsked = questionAsked;
  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
}

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom
 * */
//arrays can be created prior and passed using ... but there an unintended consequences
//for now place new Handlers and Interceptors manually, order matters!
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    ReportAnIssueIntentHandler,
    getLocation.GetLocationIntentHandler,
    getLocation.YesUseCurrentLocationIntentHandler,
    getLocation.NoUseCurrentLocationIntentHandler,
    getLocation.YesUseHomeAddressIntentHandler,
    getLocation.NoUseHomeAddressIntentHandler,
    getLocation.GetLocationHelperIntentHandler,
    liveAgent.LiveAgentIntentHandler,
    abandonedVehicle.AbandonedVehicleIntentHandler,
    abandonedVehicle.YesAbandonedVehicleIntentHandler,
    abandonedVehicle.YesAbandonedVehicleTimeIntentHandler,
    abandonedVehicle.NoAbandonedVehicleIntentHandler,
    abandonedVehicle.NoAbandonedVehicleTimeIntentHandler,
    homelessCamp.HomelessCampIntentHandler,
    homelessCamp.YesHomelessCampIntentHandler,
    homelessCamp.NoHomelessCampIntentHandler,
    potHole.PotHoleRequestHandler,
    petcomplaint.petcomplaintHandler,
    trashpickup.TrashPickUpIntentHandler,
    strayAnimal.strayAnimalHandler,
    dirtyBathroom.dirtyBathroomHandler,
    YesRetryIntentHandler,
    NoRetryIntentHandler,
    FallbackIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
    // IntentReflectorHandler,
  )
  .addRequestInterceptors(
    // NewSessionRequestInterceptor,
    // PersonalizationRequestInterceptor, //TODO: Fix whatever was happening on ronald's machine
    LocalisationRequestInterceptor,
    ContextSwitchingRequestInterceptor,
    getLocation.GetLocationRequestInterceptor
  )
  .addResponseInterceptors(
  // DelegateDirectiveResponseInterceptor
  // getLocation.DelegateToGetLocationResponseInterceptor
)
  .withApiClient(new Alexa.DefaultApiClient())
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent("DinosaurWithGrowingPains")
  .withPersistenceAdapter(
    new dynamoDbPersistenceAdapter.DynamoDbPersistenceAdapter({
      tableName: 'sac311table',
      createTable: true,
      dynamoDBClient: localDynamoDBClient // Use this only for local development
    })
  )
  .lambda();

// Custom Exports
exports.setQuestion = setQuestion