import { addEvent, EventCode } from '@/lib/events'
import { PRInfo } from "@/lib/github";
import db from "@/db";
import { PULL_REQUEST_TYPE, PULL_REQUEST_STATE } from "@/models/pullRequests";
import { isValidDate, requiredError } from '@/controllers/validator';
import { StartupPhase } from '@/models/startup';
import { makeGithubSponsorFile, makeGithubStartupFile, makeImageFile } from '@/controllers/helpers/githubHelpers/createGithubCollectionEntry';
import { GithubBetagouvFile, GithubStartupChange } from '../helpers/githubHelpers/githubEntryInterface';
import { Sponsor, SponsorDomaineMinisteriel, SponsorType } from '@/models/sponsor';
import { updateMultipleFilesPR } from '../helpers/githubHelpers';

const isValidPhase = (field, value, callback) => {
    if (!value || Object.values(StartupPhase).includes(value)) {
        return
    }
    callback(field, `La phase n'as pas une valeur valide`)
    return
}

export async function postStartupInfoCreate(req, res) {
    try {
        const formValidationErrors = {};
        const errorHandler = (field, message) => {
            const errorMessagesForKey = formValidationErrors[field] || []
            // add new message to array
            errorMessagesForKey.push(message)
            // make it one message
            formValidationErrors[field] = errorMessagesForKey
        }
        
        const phases = req.body.phases
        phases.forEach(phase => {
            isValidPhase('phase', phase.name, errorHandler)
            isValidDate('date', new Date(phase.start), errorHandler)
            !phase.end || isValidDate('date', new Date(phase.end), errorHandler)
        })
        
        const link = req.body.link
        const startup = req.body.startup || requiredError('nom du produit', errorHandler); 
        const dashlord_url = req.body.dashlord_url
        const mission = req.body.mission || requiredError('mission', errorHandler); 
        const stats_url = req.body.stats_url
        const repository = req.body.repository
        const incubator = req.body.incubator
        const contact = req.body.contact
        const sponsors = req.body.sponsors || []
        const accessibility_status = req.body.accessibility_status
        const analyse_risques_url = req.body.analyse_risques_url
        const analyse_risques = (req.body.analyse_risques === 'true' || req.body.analyse_risques === true) ? true : false
        const newSponsors : Sponsor[] = req.body.newSponsors || []
        const image: string = req.body.image

        if (newSponsors) {
            newSponsors.forEach((sponsor : Sponsor) => {
                Object.values(SponsorDomaineMinisteriel).includes(sponsor.domaine_ministeriel) || errorHandler('domaine', "le domaine n'est pas valide")
                Object.values(SponsorType).includes(sponsor.type) || errorHandler('type', "le type n'est pas valide")
            })
        }

        const content = req.body.text || requiredError('description du produit', errorHandler); 
        phases[0] || requiredError('phases', errorHandler); 

        if (Object.keys(formValidationErrors).length) {
            console.error(formValidationErrors)
            throw new Error('Erreur dans le formulaire', { cause: formValidationErrors });
        }
        let changes : GithubStartupChange = {
            link,
            dashlord_url,
            accessibility_status,
            analyse_risques_url,
            analyse_risques,
            mission,
            contact,
            stats_url,
            repository,
            incubator,
            sponsors: sponsors.map(sponsor => `/organisations/${sponsor}`)
        };
        const newPhases = phases.map(phase => ({
            ...phase,
            end: phase.end ? new Date(phase.end) : undefined,
            start: phase.start ? new Date(phase.start) : undefined,
        }))
        changes['phases'] = newPhases
        const files : GithubBetagouvFile[]  = [
            ...newSponsors.map(sponsor => makeGithubSponsorFile(sponsor.acronym, sponsor)),
            makeGithubStartupFile(startup, changes, content)
        ]
        if (image) {
            console.log('Added image file')
            const imageFile = makeImageFile(startup, image)
            files.push(imageFile)
        }
        const prInfo : PRInfo = await updateMultipleFilesPR(`Création de la fiche ${startup}`, files)

        

        addEvent(EventCode.STARTUP_INFO_CREATED, {
            created_by_username: req.auth.id,
            action_metadata: { 
                value: {
                    ...changes
                }
            }
        })
        await db('pull_requests').insert({
            url: prInfo.html_url,
            startup: startup,
            type: PULL_REQUEST_TYPE.PR_TYPE_STARTUP_UPDATE,
            status: PULL_REQUEST_STATE.PR_STARTUP_UPDATE_CREATED,
            info: JSON.stringify(changes)
        })
        const message = `⚠️ Pull request pour la création de la fiche de ${startup} ouverte. 
        \nUn membre de l'equipe doit merger la fiche : <a href="${prInfo.html_url}" target="_blank">${prInfo.html_url}</a>. 
        \nUne fois mergée, la fiche sera en ligne dans les 10 minutes.`
        req.flash('message', message);
        res.json({
            message,
            pr_url: prInfo.html_url
        });
    } catch (err) {
        console.error(err)
        res.status(400).json({
            message: err.message,
            errors: err.cause,
        });
    }
}
