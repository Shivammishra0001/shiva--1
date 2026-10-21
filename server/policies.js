// Versioned policy documents. Bump `version` when a change is material: members are then asked to accept again.
// These are DRAFTS prepared for legal review. They are labelled as drafts everywhere they are shown.
export const POLICY_IDS = ['terms', 'privacy', 'guidelines']

const draftNote = 'Draft for review. This text has not been approved by legal counsel and is not legal advice.'

export const POLICIES = {
  terms: {
    id: 'terms', title: 'Terms and Conditions', version: '2026-10-draft-1', effective: '2026-10-21', draft: true, note: draftNote,
    sections: [
      { heading: 'Using the service', body: ['You must provide accurate information when you create an account and keep your sign-in details private.', 'You are responsible for activity on your account.', 'You may use the Community and Cohort areas only in line with the Community Guidelines.'] },
      { heading: 'Your content', body: ['You keep the rights to what you post. You allow us to display it on the platform so other members can see it.', 'You must have the right to share what you post. Do not post content that infringes someone else\'s rights.'] },
      { heading: 'Moderation', body: ['We may hold, restrict or remove content and may limit or suspend accounts that break the Community Guidelines.', 'We explain our decisions where it is safe to do so, and you can appeal.'] },
      { heading: 'Changes', body: ['We may update these terms. If a change is material we will ask you to accept the new version before you continue to participate.'] },
      { heading: 'Contact', body: ['Questions about these terms: use the Contact page.'] },
    ],
  },
  privacy: {
    id: 'privacy', title: 'Privacy Policy', version: '2026-10-draft-1', effective: '2026-10-21', draft: true, note: draftNote,
    sections: [
      { heading: 'What we collect', body: ['Account details: your name, email address, phone number (with country code) and a securely hashed password.', 'Records of the policies you accepted, with the version and time.', 'Content you post and reports you send, so we can run the community and keep it safe.'] },
      { heading: 'What we do not collect', body: ['We do not ask for more personal information than we need to run your account.'] },
      { heading: 'How we use it', body: ['To sign you in, keep your account secure, show your posts, and moderate the community.', 'Phone numbers are stored but are not verified at this time.'] },
      { heading: 'Who can see it', body: ['Other members see your name and what you post. Your email and phone number are not shown to members.', 'Reporter identities are hidden from members and from most staff.', 'We share information with authorities only where the law requires it or in a genuine emergency, and we keep a record of such disclosures.'] },
      { heading: 'Retention and your choices', body: ['Resolved reports are anonymised after a retention period. You can ask us to correct or delete your account details through the Contact page.'] },
    ],
  },
  guidelines: {
    id: 'guidelines', title: 'Community Guidelines', version: '2026-10-draft-1', effective: '2026-10-21', draft: true, note: draftNote,
    sections: [
      { heading: 'Be respectful and careful with other people\'s information', body: ['Treat other members with respect. Ask permission before sharing anyone else\'s information. Report content that looks harmful or suspicious.'] },
      { heading: 'Do not post', body: [
        'Threats, or encouragement of violence.',
        'Harassment, bullying or targeted abuse, including stalking and intimidation.',
        'Doxxing: private personal information shared without a lawful basis and permission.',
        'Non-consensual intimate imagery, or any sexual exploitation content.',
        'Child sexual abuse material or any sexual exploitation of minors.',
        'Fraud, phishing, malicious links or impersonation.',
        'Spam, scams or deceptive promotions.',
        'Malware, credential theft, or instructions meant to compromise other users.',
        'Content that unlawfully discriminates against or targets people because of a protected characteristic.',
        'Copyright-infringing content where removal is required.',
        'Anything illegal, or prohibited by applicable law.',
      ] },
      { heading: 'What is welcome', body: ['Technical discussion, research and cybersecurity education are welcome, as is responsible vulnerability disclosure, as long as they do not cross into the conduct listed above. Talking about a security topic is never a violation on its own.'] },
      { heading: 'How enforcement works', body: ['People review reports. Automated checks can only hold content for a person to look at; they cannot make a final decision on ambiguous content.', 'Actions range from a warning, to removing content, a temporary posting restriction, a temporary suspension, and for severe or repeated violations a permanent suspension.', 'You will be told what was done and why, where it is safe to do so, and you can appeal. A different reviewer decides appeals.', 'We do not automatically report every flagged post to the police. Credible threats, imminent danger or child exploitation are escalated for authorised review under a documented process.'] },
    ],
  },
}

export const currentVersions = () => Object.fromEntries(POLICY_IDS.map((id) => [id, POLICIES[id].version]))
