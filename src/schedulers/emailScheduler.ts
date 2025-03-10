import crypto from 'crypto';
import _ from 'lodash/array';

import BetaGouv from '@/betagouv';
import { OvhRedirection } from '@/models/ovh';
import config from '@config';
import {
  createEmail,
  setEmailActive,
  setEmailRedirectionActive,
  setEmailSuspended,
} from '@controllers/usersController';
import * as utils from '@controllers/utils';
import knex from '@/db';
import {
  CommunicationEmailCode,
  DBUser,
  EmailStatusCode,
  MemberType,
  USER_EVENT,
} from '@/models/dbUser/dbUser';
import { Member } from '@models/member';
import { IEventBus } from '@/infra/eventBus';
import { Contact, IMailingService, MAILING_LIST_TYPE } from '@/modules/email';
import {
  addContactsToMailingLists,
  smtpBlockedContactsEmailDelete,
} from '@/config/email.config';
import betagouv from '../betagouv';
import { isBetaEmail } from '@controllers/utils';

const differenceGithubOVH = function differenceGithubOVH(user, ovhAccountName) {
  return user.id === ovhAccountName;
};

const differenceGithubRedirectionOVH = function differenceGithubOVH(
  user,
  ovhAccountName
) {
  return utils.buildBetaRedirectionEmail(user.id) === ovhAccountName;
};

const getValidUsers = async () => {
  const githubUsers = await BetaGouv.usersInfos();
  return githubUsers.filter((x) => !utils.checkUserIsExpired(x));
};

export async function setEmailAddressesActive() {
  const fiveMinutesInMs: number = 5 * 1000 * 60;
  const nowLessFiveMinutes: Date = new Date(Date.now() - fiveMinutesInMs);
  const dbUsers: DBUser[] = await knex('users')
    .whereIn('primary_email_status', [
      EmailStatusCode.EMAIL_CREATION_PENDING,
      EmailStatusCode.EMAIL_RECREATION_PENDING,
    ])
    .where('primary_email_status_updated_at', '<', nowLessFiveMinutes);
  const githubUsers: Member[] = await getValidUsers();
  const concernedUsers: DBUser[] = dbUsers.filter((user) => {
    return githubUsers.find((x) => user.username === x.id);
  });
  return Promise.all(
    concernedUsers.map(async (user) => {
      const listTypes = [MAILING_LIST_TYPE.NEWSLETTER];
      if (
        user.primary_email_status === EmailStatusCode.EMAIL_CREATION_PENDING
      ) {
        listTypes.push(MAILING_LIST_TYPE.ONBOARDING);
      }
      await addContactsToMailingLists({
        listTypes: listTypes,
        contacts: [
          {
            email:
              user.communication_email === CommunicationEmailCode.SECONDARY &&
              user.secondary_email
                ? user.secondary_email
                : user.primary_email,
            firstname: utils.capitalizeWords(user.username.split('.')[0]),
            lastname: utils.capitalizeWords(user.username.split('.')[1]),
            domaine: githubUsers.find((x) => user.username === x.id).domaine,
          },
        ],
      });
      await smtpBlockedContactsEmailDelete({ email: user.primary_email });
      await setEmailActive(user.username);
      // once email created we create marrainage
    })
  );
}

export async function setCreatedEmailRedirectionsActive() {
  const fiveMinutesInMs: number = 5 * 1000 * 60;
  const nowLessFiveMinutes: Date = new Date(Date.now() - fiveMinutesInMs);
  const dbUsers: DBUser[] = await knex('users')
    .whereIn('primary_email_status', [
      EmailStatusCode.EMAIL_REDIRECTION_PENDING,
    ])
    .where('primary_email_status_updated_at', '<', nowLessFiveMinutes)
    .where('email_is_redirection', true);

  const githubUsers: Member[] = await getValidUsers();
  const concernedUsers: DBUser[] = dbUsers.filter((user) => {
    return githubUsers.find((x) => user.username === x.id);
  });
  return Promise.all(
    concernedUsers.map(async (user) => {
      if (user.member_type === MemberType.ATTRIBUTAIRE) {
        const listTypes = [MAILING_LIST_TYPE.NEWSLETTER];
        if (
          user.primary_email_status ===
          EmailStatusCode.EMAIL_REDIRECTION_PENDING
        ) {
          listTypes.push(MAILING_LIST_TYPE.ONBOARDING);
        }
        await addContactsToMailingLists({
          listTypes: listTypes,
          contacts: [
            {
              email:
                user.communication_email === CommunicationEmailCode.SECONDARY &&
                user.secondary_email
                  ? user.secondary_email
                  : user.primary_email,
              firstname: utils.capitalizeWords(user.username.split('.')[0]),
              lastname: utils.capitalizeWords(user.username.split('.')[1]),
              domaine: githubUsers.find((x) => user.username === x.id).domaine,
            },
          ],
        });
      }
      await smtpBlockedContactsEmailDelete({ email: user.primary_email });
      await setEmailRedirectionActive(user.username);
      // once email created we create marrainage
    })
  );
}

export async function createRedirectionEmailAdresses() {
  const dbUsers: DBUser[] = await knex('users')
    .whereNull('primary_email')
    .whereIn('primary_email_status', [EmailStatusCode.EMAIL_UNSET])
    .where('email_is_redirection', true)
    .whereNotNull('secondary_email');
  const githubUsers: Member[] = await getValidUsers();
  const concernedUsers: Member[] = githubUsers.filter((user) => {
    return dbUsers.find((x) => x.username === user.id);
  });

  const redirections: OvhRedirection[] = await BetaGouv.redirections();

  const allOvhRedirectionEmails = Array.from(
    new Set([
      ...redirections.reduce(
        (acc, r) => (!isBetaEmail(r.to) ? [...acc, r.from] : acc),
        []
      ),
    ])
  ).sort();
  let unregisteredMembers: Member[] = _.differenceWith(
    concernedUsers,
    allOvhRedirectionEmails,
    differenceGithubRedirectionOVH
  );
  console.log(
    `Email creation : ${unregisteredMembers.length} unregistered user(s) in OVH (${allOvhRedirectionEmails.length} accounts in OVH. ${githubUsers.length} accounts in Github).`
  );
  unregisteredMembers = unregisteredMembers.map((member) => {
    const dbUser = dbUsers.find((dbUser) => dbUser.username === member.id);

    if (dbUser) {
      member.email = dbUser.secondary_email;
    }
    return member;
  });
  console.log(
    'User that should have redirection',
    unregisteredMembers.map((u) => u.id)
  );
  // create email and marrainage
  return Promise.all(
    unregisteredMembers.map(async (member) => {
      if (
        process.env.FEATURE_APPLY_CREATE_REDIRECTION_EMAIL ||
        process.env.NODE_ENV === 'test'
      ) {
        const email = utils.buildBetaRedirectionEmail(member.id, 'attr');
        await betagouv.createRedirection(email, member.email, false);
        const [user]: DBUser[] = await knex('users')
          .where({
            username: member.id,
          })
          .update({
            primary_email: email,
            primary_email_status: EmailStatusCode.EMAIL_REDIRECTION_PENDING,
            primary_email_status_updated_at: new Date(),
          })
          .returning('*');
        console.log(`Email redirection créée pour ${user.username}`);
      }
    })
  );
}

export async function createEmailAddresses() {
  const dbUsers: DBUser[] = await knex('users')
    .whereNull('primary_email')
    .whereIn('primary_email_status', [EmailStatusCode.EMAIL_UNSET])
    .where('email_is_redirection', false)
    .whereNotNull('secondary_email');
  const githubUsers: Member[] = await getValidUsers();

  const concernedUsers: Member[] = githubUsers.filter((user) => {
    return dbUsers.find((x) => x.username === user.id);
  });

  const allOvhEmails: string[] = await BetaGouv.getAllEmailInfos();
  const unregisteredUsers: Member[] = _.differenceWith(
    concernedUsers,
    allOvhEmails,
    differenceGithubOVH
  );
  console.log(
    `Email creation : ${unregisteredUsers.length} unregistered user(s) in OVH (${allOvhEmails.length} accounts in OVH. ${githubUsers.length} accounts in Github).`
  );

  // create email and marrainage
  return Promise.all(
    unregisteredUsers.map(async (user) => {
      await createEmail(user.id, 'Secretariat cron');
      // once email created we create marrainage
    })
  );
}

export async function reinitPasswordEmail() {
  const users: Member[] = await BetaGouv.usersInfos();
  const expiredUsers: Member[] = utils.getExpiredUsers(users, 5);
  const dbUsers: DBUser[] = await knex('users')
    .whereIn(
      'username',
      expiredUsers.map((user) => user.id)
    )
    .andWhere({
      primary_email_status: EmailStatusCode.EMAIL_ACTIVE,
    });
  return Promise.all(
    dbUsers.map(async (user) => {
      const { emailInfos } = await utils.userInfos(user.username, false);
      const newPassword = crypto
        .randomBytes(16)
        .toString('base64')
        .slice(0, -2);
      try {
        await BetaGouv.changePassword(
          user.username,
          newPassword,
          emailInfos.emailPlan
        );
        await setEmailSuspended(user.username);
        console.log(
          `Le mot de passe de ${
            user.username
          } a été modifié car son contrat finissait le ${new Date()}.`
        );
      } catch (err) {
        console.log(
          `Le mode de passe de ${user.username} n'a pas pu être modifié: ${err}`
        );
      }
    })
  );
}

export async function subscribeEmailAddresses() {
  const dbUsers: DBUser[] = await knex('users').whereNotNull('primary_email');

  const githubUsers: Member[] = await getValidUsers();
  const concernedUsers = githubUsers.reduce((acc, user) => {
    const dbUser: DBUser = dbUsers.find((x) => x.username === user.id);
    if (dbUser) {
      acc.push({ ...user, ...{ primary_email: dbUser.primary_email } });
    }
    return acc;
  }, []);

  const allIncubateurSubscribers = await BetaGouv.getMailingListSubscribers(
    config.incubateurMailingListName
  );
  const unsubscribedUsers = concernedUsers.filter((concernedUser) => {
    return !allIncubateurSubscribers.find(
      (email) =>
        email.toLowerCase() === concernedUser.primary_email.toLowerCase()
    );
  });
  console.log(
    `Email subscription : ${unsubscribedUsers.length} unsubscribed user(s) in incubateur mailing list.`
  );

  // create email and marrainage
  return Promise.all(
    unsubscribedUsers.map(async (user) => {
      await BetaGouv.subscribeToMailingList(
        config.incubateurMailingListName,
        user.primary_email
      );
      console.log(`Subscribe ${user.primary_email} to mailing list incubateur`);
    })
  );
}

export async function unsubscribeEmailAddresses() {
  const dbUsers: DBUser[] = await knex('users').whereNotNull('primary_email');
  const githubUsers = await BetaGouv.usersInfos().then((users) =>
    users.filter((x) => utils.checkUserIsExpired(x))
  );

  const concernedUsers = githubUsers.reduce((acc, user) => {
    const dbUser: DBUser = dbUsers.find((x) => x.username === user.id);
    if (dbUser) {
      acc.push({ ...user, ...{ primary_email: dbUser.primary_email } });
    }
    return acc;
  }, []);

  const allIncubateurSubscribers: string[] =
    await BetaGouv.getMailingListSubscribers(config.incubateurMailingListName);
  const emails = allIncubateurSubscribers.filter((email) => {
    return concernedUsers.find(
      (concernedUser) =>
        email.toLowerCase() === concernedUser.primary_email.toLowerCase()
    );
  });

  console.log(
    `Email unsubscription : ${emails.length} subscribed user(s) in incubateur mailing list.`
  );

  // create email and marrainage
  return Promise.all(
    emails.map(async (email) => {
      await BetaGouv.unsubscribeFromMailingList(
        config.incubateurMailingListName,
        email
      );
      console.log(`Unsubscribe ${email} from mailing list incubateur`);
    })
  );
}

export async function consumePrimaryEmailStatusEvent(EventBus: IEventBus) {
  const messageHandler = async ({ user_id }: { user_id: string }) => {
    EventBus.produce(USER_EVENT.ADD_USER_TO_ONBOARDING_MAILING_LIST, {
      user_id,
    });
    // potentialy other events toproduce
  };
  EventBus.consume(USER_EVENT.USER_EMAIL_ACTIVATED, messageHandler);
}

export async function addUserToOnboardingMailingList(
  EventBus: IEventBus,
  MailingService: IMailingService
) {
  const messageHandler = async ({ contact }: { contact: Contact }) => {
    MailingService.addContactsToMailingLists({
      listTypes: [MAILING_LIST_TYPE.ONBOARDING],
      contacts: [contact],
    });
  };
  EventBus.consume(
    USER_EVENT.ADD_USER_TO_ONBOARDING_MAILING_LIST,
    messageHandler
  );
}

export async function addUserToNewsletterMailingList(
  MailingService: IMailingService,
  contact: Contact
) {
  MailingService.addContactsToMailingLists({
    listTypes: [MAILING_LIST_TYPE.NEWSLETTER],
    contacts: [contact],
  });
}

export async function setEmailStatusActiveForUsers() {
  const dbUsers: DBUser[] = await knex('users')
    .whereNull('primary_email')
    .whereIn('primary_email_status', [EmailStatusCode.EMAIL_UNSET])
    .whereNotNull('secondary_email');
  const activeUsers: Member[] = await BetaGouv.getActiveRegisteredOVHUsers();

  const concernedUsers: Member[] = activeUsers.filter((user) => {
    return dbUsers.find((x) => x.username === user.id);
  });

  // create email and marrainage
  return Promise.all(
    concernedUsers.map(async (user) => {
      console.log('This user has active email', user.id);
      // once email created we create marrainage
    })
  );
}
