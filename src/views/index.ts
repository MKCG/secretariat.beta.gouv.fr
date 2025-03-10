import { makeHtml } from './index.html'
import { Home } from './pages/HomePage'
import { Admin } from './pages/AdminPage'
import { InfoUpdate } from './pages/InfoUpdatePage'
import { Onboarding } from './pages/OnboardingPage'
import { Community } from './pages/CommunityPage'
import { AdminMattermost } from './pages/AdminMattermostPage'
import { BaseInfoUpdate } from './pages/BaseInfoUpdatePage'
import { WhatIsGoingOnWithMember } from './pages/WhatIsGoingOnWithMemberPage'
import { Badge } from './pages/BadgePage/Badge'
import { StartupInfoUpdate } from './pages/StartupInfoUpdatePage'
import { StartupList } from './pages/StartupListPage'
import { StartupInfoCreate } from './pages/StartupInfoCreatePage'

export const HomePage = (props: Parameters<typeof Home>[0]) =>
  makeHtml({
    Component: Home,
    props,
    hydrate: true,
    title: 'Espace-Membre BetaGouv',
    pageName: 'Home', // This must match the Component name
  })

  export const OnboardingPage = (props: Parameters<typeof Onboarding>[0]) =>
  makeHtml({
    Component: Onboarding,
    props,
    hydrate: true,
    title: 'Espace-Membre BetaGouv',
    pageName: 'Onboarding', // This must match the Component name
  })

  export const CommunityPage = (props: Parameters<typeof Community>[0]) =>
  makeHtml({
    Component: Community,
    props,
    hydrate: true,
    title: 'Page communauté',
    pageName: 'Community', // This must match the Component name
  })


export const AdminPage = (props: Parameters<typeof Admin>[0]) =>
  makeHtml({
    Component: Admin,
    props,
    hydrate: true,
    title: 'Administration Page',
    pageName: 'Admin', // This must match the Component name
  })

export const InfoUpdatePage = (props: Parameters<typeof InfoUpdate>[0]) =>
  makeHtml({
    Component: InfoUpdate,
    props,
    hydrate: true,
    title: 'Mise à jour de mes infos - Espace Membre',
    pageName: 'InfoUpdate', // This must match the Component name
  })

export const BaseInfoUpdatePage = (props: Parameters<typeof BaseInfoUpdate>[0]) =>
  makeHtml({
    Component: BaseInfoUpdate,
    props,
    hydrate: true,
    title: 'Mise à jour de mes infos - Espace Membre',
    pageName: 'BaseInfoUpdate', // This must match the Component name
})


export const AdminMattermostPage = (props: Parameters<typeof AdminMattermostPage>[0]) => makeHtml({
  Component: AdminMattermost,
  props,
  hydrate: true,
  title: 'Administration Mattermost Page',
  pageName: 'AdminMattermost', // This must match the Component name
})

export const WhatIsGoingOnWithMemberPage = (props: Parameters<typeof WhatIsGoingOnWithMemberPage>[0]) => makeHtml({
  Component: WhatIsGoingOnWithMember,
  props,
  hydrate: true,
  title: 'Que ce passe-t-il Page',
  pageName: 'WhatIsGoingOnWithMember', // This must match the Component name
})

export const StartupInfoUpdatePage = (props: Parameters<typeof StartupInfoUpdatePage>[0]) => makeHtml({
  Component: StartupInfoUpdate,
  props,
  hydrate: true,
  title: 'Mise à jour des informations du produit',
  pageName: 'StartupInfoUpdate', // This must match the Component name
})

export const StartupInfoCreatePage = (props: Parameters<typeof StartupInfoUpdatePage>[0]) => makeHtml({
  Component: StartupInfoCreate,
  props,
  hydrate: true,
  title: 'Créer une fiche produit',
  pageName: 'StartupInfoCreate', // This must match the Component name
})

export const StartupListPage = (props: Parameters<typeof StartupListPage>[0]) => makeHtml({
  Component: StartupList,
  props,
  hydrate: true,
  title: 'Voir la liste des produits',
  pageName: 'StartupList', // This must match the Component name
})

export const BadgePage = (props: Parameters<typeof BadgePage>[0]) => makeHtml({
  Component: Badge,
  props,
  hydrate: true,
  title: 'Faire une demande de badge',
  pageName: 'Badge', // This must match the Component name
})

// export const VisitPage = (props: Parameters<typeof BadgePage>[0]) => makeHtml({
//   Component: Visit,
//   props,
//   hydrate: true,
//   title: 'Faire une demande de visite',
//   pageName: 'Visit', // This must match the Component name
// })
