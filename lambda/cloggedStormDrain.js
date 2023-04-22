const Alexa = require("ask-sdk-core")
const helper = require("./helper/helperFunctions.js")
const sfCase = require("./helper/SalesforceCaseObject.js")

//Started
const StartedCloggedStormDrainIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === "CloggedStormDrainIntent" &&
            Alexa.getDialogState(handlerInput.requestEnvelope) === "STARTED"
        )
    },
    async handle(handlerInput) {

        helper.setQuestion(handlerInput, null)
        const { requestEnvelope, responseBuilder, attributesManager } = handlerInput;
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.intentToRestore = 'CloggedStormDrainIntent';
        attributesManager.setSessionAttributes(sessionAttributes);

		let GetLocationFromUserIntent = {
			name: 'GetLocationFromUserIntent',
			confirmationStatus: 'NONE',
			slots: {
				userGivenAddress: {
					name: 'userGivenAddress',
					value: null,
					confirmationStatus: 'NONE'
		}}}
		return responseBuilder
		    .speak(handlerInput.t('CLOGGED_INTRO'))
		    .addElicitSlotDirective('userGivenAddress', GetLocationFromUserIntent)
		    .getResponse();
    }
}

//In-progress
const InProgressCloggedStormDrainIntentHandler = {
    canHandle(handlerInput) {
		return (
			Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
			&& Alexa.getIntentName(handlerInput.requestEnvelope) === "CloggedStormDrainIntent"
			&& Alexa.getDialogState(handlerInput.requestEnvelope) === "IN_PROGRESS"
		)
	},
	async handle(handlerInput) {
        helper.setQuestion(handlerInput, null)
        helper.setQuestion(handlerInput, 'finishClogged?')

        const { requestEnvelope, responseBuilder, attributesManager } = handlerInput;
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.intentToRestore = 'CloggedStormDrainIntent';
        attributesManager.setSessionAttributes(sessionAttributes);

        let GetGenericDescriptionFromUserIntent = {
			name: 'GetGenericDescriptionFromUserIntent',
			confirmationStatus: 'NONE',
			slots: {
				GenericDescription: {
					name: 'GenericDescription',
					value: null,
					confirmationStatus: 'NONE'
		}}}
		return responseBuilder
		    .speak(handlerInput.t('CLOGGED_DESC'))
		    .addElicitSlotDirective('GenericDescription', GetGenericDescriptionFromUserIntent)
		    .getResponse();
    }
}

//Ending
const CompletedCloggedStormDrainIntentHandler = {
    canHandle(handlerInput) {
		return (
			Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
			Alexa.getIntentName(handlerInput.requestEnvelope) === 'CloggedStormDrainIntent' &&
            handlerInput.attributesManager.getSessionAttributes().questionAsked === 'finishClogged?'
		);
	},
    async handle(handlerInput) {
        helper.setQuestion(handlerInput, null)
		const { requestEnvelope, responseBuilder, attributesManager } = handlerInput;
		const sessionAttributes = attributesManager.getSessionAttributes();

        let phoneNumber = '9169166969'
        const token = await helper.getOAuthToken();
        const myCaseObj = new sfCase(token);
        var address = sessionAttributes.confirmedValidatorRes.Address;
        //const genericDescription = sessionAttributes.CloggedStormDrainIntent.GenericDescription;
        const userResponses = {
		    'GenericDescription': sessionAttributes.CloggedStormDrainIntent.GenericDescription
		}
		const create_case_response = await helper.createGenericCase(myCaseObj, 'Curb/Gutter', userResponses, null, address, phoneNumber);
		console.log(userResponses);

		const update_case_response = await helper.updateGenericCase(myCaseObj, 'Curb/Gutter', userResponses, create_case_response.case_id, address, phoneNumber);
        console.log(update_case_response);

        helper.setQuestion(handlerInput, 'AnythingElse?')
		return handlerInput.responseBuilder
		    .speak(handlerInput.t('CLOGGED_THANKS'))
		    .getResponse();
    }
}

module.exports = {
    StartedCloggedStormDrainIntentHandler,
	InProgressCloggedStormDrainIntentHandler,
    CompletedCloggedStormDrainIntentHandler
}