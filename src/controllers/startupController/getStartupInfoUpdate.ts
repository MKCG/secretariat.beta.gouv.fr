import betagouv from '@/betagouv';
import { StartupInfoUpdatePage } from '@views';
import { PULL_REQUEST_STATE } from '@/models/pullRequests';
import db from '@/db';
import { StartupInfo } from '@/models/startup';
import config from '@/config';

export async function getStartupInfoUpdate(req, res) {
  getStartupInfoUpdatePageData(
    req,
    res,
    (data) => {
      res.send(
        StartupInfoUpdatePage({
          ...data,
          errors: req.flash('error'),
          messages: req.flash('message'),
          request: req,
        })
      );
    },
    (err) => {
      console.error(err);
      req.flash(
        'error',
        'Impossible de récupérer les information de la startup.'
      );
      return res.redirect('/');
    }
  );
}

export async function getStartupInfoUpdateApi(req, res) {
  getStartupInfoUpdatePageData(
    req,
    res,
    (data) => {
      res.json({
        ...data,
      });
    },
    (err) => {
      res.status(500).json({
        error: 'Impossible de récupérer les information de la startup.',
      });
    }
  );
}

async function getStartupInfoUpdatePageData(req, res, onSuccess, onError) {
  try {
    const title = 'Changer une startup de phase';
    const formValidationErrors = {};
    const startup: StartupInfo = await betagouv
      .startupsInfos()
      .then((startups) => startups.find((s) => s.id === req.params.startup));
    const updatePullRequest = await db('pull_requests')
      .where({
        status: PULL_REQUEST_STATE.PR_STARTUP_UPDATE_CREATED,
        startup: req.params.startup,
      })
      .orderBy('created_at', 'desc')
      .first();
    onSuccess({
      title,
      formValidationErrors,
      currentUserId: req.auth.id,
      isAdmin: config.ESPACE_MEMBRE_ADMIN.includes(req.auth.id),
      activeTab: 'startups',
      subActiveTab: 'udpate-phase',
      username: req.auth.id,
      formData: {
        link: startup.attributes.link,
        dashlord_url: startup.attributes.dashlord_url,
        repository: startup.attributes.repository,
        mission: startup.attributes.pitch,
        stats_url: startup.attributes.stats_url,
        incubator: startup.relationships.incubator.data.id,
        sponsors: startup.attributes.sponsors,
        contact: startup.attributes.contact,
      },
      updatePullRequest,
      startup,
    });
  } catch (err) {
    onError(err);
  }
}
