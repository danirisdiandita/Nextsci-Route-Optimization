import { REPO_URL, SERVICES_EMAIL } from './content'

export type LegalSection = { heading: string; body: string[]; list?: string[] }

export type LegalDoc = { title: string; updated: string; intro: string; sections: LegalSection[] }

export const terms: LegalDoc = {
  title: 'Terms of service',
  updated: '22 November 2026',
  intro:
    'These terms cover the Nextsci website, the open-source Nextsci software, and the consulting services we offer around it. Nextsci does not run a hosted cloud version of the software.',
  sections: [
    {
      heading: 'The open-source software',
      body: [
        `The Nextsci source code is published at ${REPO_URL}. Its open-source license, in the LICENSE file of that repository, sets what you may do with the code. Nothing in these terms takes away a right that license gives you.`,
        'The software is free. You can download it, run it on your own servers, change it, and share it under the terms of that license. You do not need an account with us to use it.',
      ],
    },
    {
      heading: 'Running Nextsci yourself',
      body: [
        'When you install Nextsci, you run your own copy. We do not operate it, we cannot see the orders, routes, drivers, or customers you store in it, and the software does not send that data to us.',
        'You are responsible for your installation, including:',
      ],
      list: [
        'the servers, networks, and accounts it runs on',
        'security updates, backups, and access control',
        'the personal data of your drivers and customers, and the laws that apply to it',
        'any maps, routing, or messaging services you connect to it',
      ],
    },
    {
      heading: 'No warranty',
      body: [
        'The software is provided "as is", without warranty of any kind, as its license states. Routes, arrival times, and other results it produces are estimates. Check them before you rely on them.',
      ],
    },
    {
      heading: 'Consulting services',
      body: [
        'We offer installation, managed hosting, integrations, and consultation for Nextsci. Each engagement starts with a written agreement, such as a proposal or a statement of work, that sets the scope, fees, schedule, and how we handle your data.',
        'That agreement governs the engagement. If it conflicts with these terms, the agreement wins. Managed hosting is a dedicated installation for one client under such an agreement, not a shared cloud service.',
      ],
    },
    {
      heading: 'Contributions',
      body: [
        'If you send code, documentation, or other changes to the Nextsci repository, you agree that we may publish them under the same open-source license as the rest of the project, and you confirm that you have the right to do so.',
      ],
    },
    {
      heading: 'Name and logo',
      body: [
        'The open-source license covers the code, not the Nextsci name or logo. You may say that your product uses or is based on Nextsci. Do not use the name or logo in a way that suggests we made, endorse, or support your product or service.',
      ],
    },
    {
      heading: 'Limitation of liability',
      body: [
        'To the extent the law allows, we are not liable for indirect or consequential losses, or for lost profits, revenue, or data, that arise from the website or the software. Liability for consulting services is set in the agreement for that engagement.',
      ],
    },
    {
      heading: 'Changes to these terms',
      body: [
        'We may update these terms as the project grows, for example if we launch a hosted service. The date at the top of this page shows the latest version. Changes do not apply to a signed services agreement unless both sides agree.',
      ],
    },
    {
      heading: 'Contact',
      body: [`Questions about these terms go to ${SERVICES_EMAIL}.`],
    },
  ],
}

export const privacy: LegalDoc = {
  title: 'Privacy policy',
  updated: '22 November 2026',
  intro:
    'This policy explains what personal data we collect through the Nextsci website and our consulting services, and what we do with it. The short version: the website has no analytics and sets no cookies, and the software you install does not report to us.',
  sections: [
    {
      heading: 'Software you run yourself',
      body: [
        'When you install Nextsci, the data you put into it stays on your servers. The software contains no telemetry and does not send usage data, orders, routes, or locations to us.',
        'You decide what data your installation holds and you are responsible for it under the privacy laws that apply to you. The dashboard loads the Inter font from Google Fonts, so the browsers of your users contact Google when they open it.',
      ],
    },
    {
      heading: 'This website',
      body: [
        'The website uses no analytics, no advertising, and no tracking cookies. It does not ask you to sign in.',
        'A few things still happen when you visit:',
      ],
      list: [
        'Our hosting provider receives your IP address and browser details with each request, as every web server does, and may keep them in short-lived logs.',
        'The page loads the Inter font from Google Fonts, so your browser sends a request to Google.',
        'If you pick light or dark mode, your browser remembers the choice in its local storage. It never leaves your device.',
      ],
    },
    {
      heading: 'When you email us',
      body: [
        `If you write to ${SERVICES_EMAIL}, we receive your email address, your name, and whatever you put in the message. We use it to answer you and, if you hire us, to provide the services you asked for. Our email provider stores these messages for us.`,
      ],
    },
    {
      heading: 'Consulting clients',
      body: [
        'When we install, host, or integrate Nextsci for you, we may handle personal data that belongs to you and your customers. We use it only to deliver the work you hired us for, and only as your written agreement with us allows. That agreement sets how long we keep it and how we return or delete it.',
      ],
    },
    {
      heading: 'What we do not do',
      body: ['We do not sell your personal data, share it with advertisers, or use it to build profiles of you.'],
    },
    {
      heading: 'How long we keep it',
      body: [
        'We keep enquiry emails for as long as we need them to answer you, and longer only if you become a client or the law requires us to keep records.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        `You can ask us what personal data we hold about you, and ask us to correct or delete it. Email ${SERVICES_EMAIL} and we will answer within 30 days.`,
      ],
    },
    {
      heading: 'Changes to this policy',
      body: [
        'If we start collecting new data, for example because we launch a hosted service, we will update this page first. The date at the top shows the latest version.',
      ],
    },
  ],
}
