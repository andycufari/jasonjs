"use client";
import TextGenerateEffect from "@/components/user/ui/text-generation";


function TextGeneration({ text, className, filter = true, duration = 0.5, textClassName = "text-2xl font-bold" }) {
  return <div className="pt-40 pb-40 bg-blue-500">
        <TextGenerateEffect words={text} className={className} filter={filter} duration={duration} textClassName={textClassName} />
        <h2 className="text-center text-white text-6xl font-bold mt-20">🇦🇷</h2>
        
    </div>
}

export default TextGeneration;

/*
{
    "component": "TextGeneration",
    "attributes": {
        "text": "Hello, world!",
        "className": "text-2xl font-bold",
        "filter": true,
        "duration": 0.5,
        "textClassName": "text-2xl font-bold"
    }
}
*/