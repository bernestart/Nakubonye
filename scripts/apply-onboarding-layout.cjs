const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/screens/CreatorOnboarding.jsx');
let src = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!src.includes('CreatorStepLayout')) {
  src = src.replace(
    "import { useState } from 'react'", 
    "import { useState } from 'react'\nimport CreatorStepLayout from '../components/creator/CreatorStepLayout'"
  );
}

// 2. Find the start and end of the return block
const startMarker = '  return (\n    <div className="fixed inset-0 z-[400] bg-transparent flex flex-col">';
const endMarker = 'function StepWelcome(';

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('❌ Anchors not found. Aborting.');
  process.exit(1);
}

// 3. Build the new return block
const newReturn = `  const STEPS_DATA = [
    { title: 'Welcome', img: '/illustrations/creator/welcome.svg' },
    { title: 'Audience', img: '/illustrations/creator/audience.svg' },
    { title: 'Default audience', img: '/illustrations/creator/privacy.svg' },
    { title: 'Monetization', img: '/illustrations/creator/money.svg' },
    { title: 'Professional tools', img: '/illustrations/creator/tools.svg' },
    { title: 'Finish', img: '/illustrations/creator/finish.svg' },
  ]

  return (
    <CreatorStepLayout
      step={step}
      totalSteps={TOTAL_STEPS}
      title={STEPS_DATA[step]?.title || 'Creator Mode'}
      onBack={step === 0 ? onClose : back}
      onClose={onClose}
      onNext={step === TOTAL_STEPS - 1 ? finish : next}
      isLast={step === TOTAL_STEPS - 1}
      nextText="Next"
    >
      <div className="flex justify-center mb-6">
        <img 
          src={STEPS_DATA[step]?.img} 
          alt={STEPS_DATA[step]?.title} 
          className="w-full max-w-[280px] h-auto object-contain drop-shadow-xl" 
        />
      </div>

      {step === 0 && <StepWelcome />}
      {step === 1 && <StepDefineAudience />}
      {step === 2 && (
        <StepPickAudience
          audience={audience}
          setAudience={setAudience}
          onReview={() => setReviewOpen(true)}
        />
      )}
      {step === 3 && <StepMonetization />}
      {step === 4 && <StepCreatorTools />}
      {step === 5 && (
        <StepFrame shareUpdate={shareUpdate} setShareUpdate={setShareUpdate} />
      )}

      {reviewOpen && (
        <ReviewSheet
          audience={audience}
          onClose={() => setReviewOpen(false)}
          onConfirm={() => { setReviewOpen(false); next() }}
        />
      )}
    </CreatorStepLayout>
  )
}

`;

// 4. Replace the old block
src = src.substring(0, startIdx) + newReturn + src.substring(endIdx);

fs.writeFileSync(file, src);
console.log('✅ CreatorOnboarding.jsx updated with animated layout and illustrations');
