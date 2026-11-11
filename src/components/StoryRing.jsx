import React from "react";

export default function StoryRing({ user, viewedStories = {}, size = 48, children }) {
  const userStories = user?.stories || [];
  const hasStories = userStories.length > 0;
  
  if (!hasStories) return children;

  const isInnerCircle = userStories.some(s => s.audience === 'inner_circle' || s.audience === 'close');
  const seenStates = userStories.map(s => !!viewedStories[s.id]);
  const allSeen = seenStates.every(Boolean);

  if (allSeen) {
    return (
      <div className="story-ring-base story-ring-fb-seen" style={{ width: size, height: size }}>
        <div className="w-full h-full bg-[#0B0B14] rounded-full overflow-hidden p-[2px]">
          <div className="w-full h-full rounded-full overflow-hidden">{children}</div>
        </div>
      </div>
    );
  }

  let backgroundStyle = isInnerCircle ? "linear-gradient(135deg, #10B981, #34D399)" : "#1877F2";

  if (userStories.length > 1 && seenStates.some(Boolean)) {
    const segmentAngle = 360 / userStories.length;
    const gradientParts = [];
    seenStates.forEach((seen, index) => {
      const start = index * segmentAngle;
      const end = (index + 1) * segmentAngle;
      const color = seen ? "rgba(255,255,255,0.2)" : (isInnerCircle ? "#10B981" : "#1877F2");
      gradientParts.push(`${color} ${start}deg ${end}deg`);
    });
    backgroundStyle = `conic-gradient(${gradientParts.join(", ")})`;
  }

  return (
    <div className="story-ring-base" style={{ width: size, height: size, background: backgroundStyle }}>
      <div className="w-full h-full bg-[#0B0B14] rounded-full overflow-hidden p-[2px]">
        <div className="w-full h-full rounded-full overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
