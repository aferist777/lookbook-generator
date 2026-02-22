import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Loader2, Image as ImageIcon, Wand2, Upload, X, Key, CheckCircle2, Circle, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [hasKey, setHasKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  // Global State
  const [activeTab, setActiveTab] = useState(1);
  const [lookbookImg, setLookbookImg] = useState<string | null>(null);
  const [poseImg, setPoseImg] = useState<string | null>(null);
  const [modelImg, setModelImg] = useState<string | null>(null);

  // Tab 1 State
  const [t1VisualIdeas, setT1VisualIdeas] = useState('');
  const [t1Occasion, setT1Occasion] = useState('');
  const [t1IsGenerating, setT1IsGenerating] = useState(false);
  const [t1GeneratedImages, setT1GeneratedImages] = useState<string[]>([]);
  const [t1Error, setT1Error] = useState<string | null>(null);

  // Tab 2 State
  const [t2SourceImg, setT2SourceImg] = useState<string | null>(null);
  const [t2IsGenerating, setT2IsGenerating] = useState(false);
  const [t2GeneratedPose, setT2GeneratedPose] = useState<string | null>(null);
  const [t2GeneratedLookbook, setT2GeneratedLookbook] = useState<string | null>(null);
  const [t2Error, setT2Error] = useState<string | null>(null);
  const t2FileRef = useRef<HTMLInputElement>(null);

  // Tab 3 State
  const [t3Environment, setT3Environment] = useState('');
  const [t3HeadSwapOnly, setT3HeadSwapOnly] = useState(false);
  const [t3IsGenerating, setT3IsGenerating] = useState(false);
  const [t3GeneratedImage, setT3GeneratedImage] = useState<string | null>(null);
  const [t3Error, setT3Error] = useState<string | null>(null);

  // Tab 4 State
  const [t4EnvRefImg, setT4EnvRefImg] = useState<string | null>(null);
  const [t4EnvDetails, setT4EnvDetails] = useState('');
  const [t4IsGenerating, setT4IsGenerating] = useState(false);
  const [t4GeneratedImg, setT4GeneratedImg] = useState<string | null>(null);
  const [t4Error, setT4Error] = useState<string | null>(null);
  const t4FileRef = useRef<HTMLInputElement>(null);

  // Global UI State
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          const keySelected = await window.aistudio.hasSelectedApiKey();
          setHasKey(keySelected);
        } else {
          setHasKey(true);
        }
      } catch (e) {
        setHasKey(true);
      } finally {
        setIsCheckingKey(false);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAnalyzeT4 = async () => {
    if (!t3GeneratedImage) {
      setT4Error('No image available to analyze.');
      return;
    }
    setT4IsGenerating(true);
    setT4Error(null);
    setT4GeneratedImg(null);

    const prompt = `Role: You are an Expert Environment Compositor. 
Your task is to perform a high-end photorealistic compositing task.
1. Identify and isolate the complete character (the model, their pose, and clothing) from the first provided image (the subject). This character asset must remain unchanged in appearance.
2. If a second image is provided (environment reference), utilize ONLY its scenery, background elements, lighting, and atmosphere. STRICTLY IGNORE and remove any humans, characters, or animals present in that reference image.
3. Use the following text prompts to refine the mood, lighting, and scene details: "${t4EnvDetails}".
4. Place the isolated character subject into the new targeted environment.
5. ENSURE AN ORGANIC FIT: Re-light the character to match the new environment's lighting (e.g., color temperature, direction). Generate realistic cast shadows onto the new ground/objects. Adjust color grading to match the scene's atmosphere. Ensure correct perspective integration so the character appears physically grounded in the new location, not just pasted over it.`;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
      const parts: any[] = [];
      
      // Subject image
      const subBase64 = t3GeneratedImage.split(',')[1];
      const subMime = t3GeneratedImage.split(';')[0].split(':')[1];
      parts.push({ inlineData: { data: subBase64, mimeType: subMime } });

      // Env ref image (optional)
      if (t4EnvRefImg) {
        const envBase64 = t4EnvRefImg.split(',')[1];
        const envMime = t4EnvRefImg.split(';')[0].split(':')[1];
        parts.push({ inlineData: { data: envBase64, mimeType: envMime } });
      }

      parts.push({ text: prompt });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "3:4",
            imageSize: "1K"
          }
        }
      });
      
      if (response.candidates && response.candidates[0] && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            setT4GeneratedImg(`data:image/png;base64,${part.inlineData.data}`);
            return;
          }
        }
      }
      setT4Error('Failed to generate composition. Please try again.');
    } catch (err: any) {
      if (err.message === "API_KEY_ERROR" || (err.message && err.message.includes("Requested entity was not found"))) {
         setHasKey(false);
         if (window.aistudio && window.aistudio.openSelectKey) {
            await window.aistudio.openSelectKey();
            setHasKey(true);
         }
      } else {
         setT4Error(err.message || 'An error occurred during composition.');
      }
    } finally {
      setT4IsGenerating(false);
    }
  };

  const Lightbox = () => (
    <AnimatePresence>
      {lightboxImg && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
        >
          <motion.img
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            src={lightboxImg}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            alt="Lightbox"
          />
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  useEffect(() => {
    if (lookbookImg && !t2SourceImg) {
      setT2SourceImg(lookbookImg);
    }
  }, [lookbookImg]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setter(event.target.result as string);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const generateImage = async (prompt: string, images: string[] = [], numVariants = 1) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
    const parts: any[] = [];
    images.forEach(img => {
      const base64Data = img.split(',')[1];
      const mimeType = img.split(';')[0].split(':')[1];
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    });
    parts.push({ text: prompt });

    const generateVariant = async () => {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: "3:4",
              imageSize: "1K"
            }
          }
        });

        if (response.candidates && response.candidates[0] && response.candidates[0].content.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              return `data:image/png;base64,${part.inlineData.data}`;
            }
          }
        }
        return null;
      } catch (e: any) {
        console.error("Error generating variant:", e);
        if (e.message && e.message.includes("Requested entity was not found")) {
           throw new Error("API_KEY_ERROR");
        }
        return null;
      }
    };

    const promises = Array.from({ length: numVariants }).map(() => generateVariant());
    const results = await Promise.all(promises);
    return results.filter(Boolean) as string[];
  };

  const handleGenerateT1 = async () => {
    if (!t1VisualIdeas.trim()) {
      setT1Error('Please describe your visual ideas.');
      return;
    }
    setT1IsGenerating(true);
    setT1Error(null);
    setT1GeneratedImages([]);

    const prompt = `Create a fashion lookbook image on a pure white background.
Visual ideas: ${t1VisualIdeas}.
Context/Occasion: ${t1Occasion}.
IMPORTANT INSTRUCTIONS:
1. DO NOT include any people or characters in the image. ONLY show the clothing items, shoes, and accessories laid out or floating.
2. The background MUST be pure white.
3. Draw thin, elegant arrows pointing to 3-4 specific clothing details or accessories in the outfit.
4. Next to each arrow, write a short 2-4 word text label describing that specific detail in English.
5. Do not overlay any "event" or promotional text on the images. Only include brief, descriptive English text detailing the clothing items.
6. The style should be a professional fashion editorial or design sketch.`;

    try {
      const results = await generateImage(prompt, [], 2);
      if (results.length > 0) {
        setT1GeneratedImages(results);
      } else {
        setT1Error('Failed to generate images. Please try again.');
      }
    } catch (err: any) {
      if (err.message === "API_KEY_ERROR") {
         setHasKey(false);
         if (window.aistudio && window.aistudio.openSelectKey) {
            await window.aistudio.openSelectKey();
            setHasKey(true);
         }
      } else {
         setT1Error(err.message || 'An error occurred during generation.');
      }
    } finally {
      setT1IsGenerating(false);
    }
  };

  const handleGenerateT2 = async () => {
    if (!t2SourceImg) {
      setT2Error('Please upload a source image first.');
      return;
    }
    setT2IsGenerating(true);
    setT2Error(null);
    setT2GeneratedPose(null);
    setT2GeneratedLookbook(null);

    const posePrompt = `Convert the uploaded image into a pencil sketch. Redraw the main character as an IKEA-style wooden mannequin. The mannequin must have NO visible joints on the elbows or knees, NO hair, and must be completely gender-neutral (sexless). IMPORTANT: The mannequin's face must accurately reflect the facial expression and emotions of the person in the original image. The purpose is to capture both the pose and the emotional state.`;
    const lookbookPrompt = `Analyze the reference image and extract purely the clothing style, garments, and accessories. Generate a clean, photorealistic "lookbook" image focusing solely on these items laid out or floating on a pure white background. Do not include any people or characters.`;

    try {
      const [poseResults, lookbookResults] = await Promise.all([
        generateImage(posePrompt, [t2SourceImg], 1),
        generateImage(lookbookPrompt, [t2SourceImg], 1)
      ]);
      
      if (poseResults.length > 0 && lookbookResults.length > 0) {
        setT2GeneratedPose(poseResults[0]);
        setT2GeneratedLookbook(lookbookResults[0]);
        setPoseImg(poseResults[0]);
        setLookbookImg(lookbookResults[0]);
      } else {
        setT2Error('Failed to generate images. Please try again.');
      }
    } catch (err: any) {
      if (err.message === "API_KEY_ERROR") {
         setHasKey(false);
         if (window.aistudio && window.aistudio.openSelectKey) {
            await window.aistudio.openSelectKey();
            setHasKey(true);
         }
      } else {
         setT2Error(err.message || 'An error occurred during generation.');
      }
    } finally {
      setT2IsGenerating(false);
    }
  };

  const handleGenerateT3 = async () => {
    if (!modelImg) {
      setT3Error('Please provide the Model Portrait.');
      return;
    }

    if (!t3HeadSwapOnly && (!lookbookImg || !poseImg)) {
      setT3Error('Please provide both Lookbook and Pose images for Full Generation.');
      return;
    }

    if (t3HeadSwapOnly && !t2SourceImg) {
      setT3Error('Original reference image not found. Please upload it in Tab 2 or ensure it was routed correctly.');
      return;
    }

    setT3IsGenerating(true);
    setT3Error(null);
    setT3GeneratedImage(null);

    let prompt = "";
    let images: string[] = [];

    if (t3HeadSwapOnly) {
      prompt = `Perform a Head Swap only. Use the first provided image (reference_image.png) as the foundational base image. Strictly preserve its exact body shape, background, lighting, and clothing. ONLY replace the head, face, and hair with the features from the second provided image (main_celebrity_ai_model.png). Completely IGNORE any sketches or lookbooks for this specific action.`;
      images = [t2SourceImg!, modelImg];
    } else {
      prompt = `Generate a new character from scratch. Apply the facial features from the third provided image (main_celebrity_ai_model.png), construct the posture strictly based on the second provided image (scene_draft.png), and dress the model using the garments from the first provided image (extracted_lookbook.png).`;
      images = [lookbookImg!, poseImg!, modelImg];
    }

    if (t3Environment.trim()) {
      prompt += `\n\nEnvironment & Specific Details:\n${t3Environment}\n\nMake sure to incorporate these environment and specific details into the final image, defining the setting and atmosphere around the combined model, pose, and lookbook.`;
    }

    try {
      const results = await generateImage(prompt, images, 1);
      if (results.length > 0) {
        setT3GeneratedImage(results[0]);
      } else {
        setT3Error('Failed to generate final image. Please try again.');
      }
    } catch (err: any) {
      if (err.message === "API_KEY_ERROR") {
         setHasKey(false);
         if (window.aistudio && window.aistudio.openSelectKey) {
            await window.aistudio.openSelectKey();
            setHasKey(true);
         }
      } else {
         setT3Error(err.message || 'An error occurred during generation.');
      }
    } finally {
      setT3IsGenerating(false);
    }
  };

  const ImageSlot = ({ title, image, onUpload, onRemove }: { title: string, image: string | null, onUpload: (img: string) => void, onRemove: () => void }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    return (
      <div className="flex flex-col space-y-3">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{title}</label>
        {image ? (
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-200 group bg-white">
            <img
              src={image}
              className="w-full h-full object-contain cursor-zoom-in"
              alt={title}
              onClick={() => setLightboxImg(image)}
            />
            <button onClick={(e) => { e.stopPropagation(); downloadImage(image, `${title}.png`); }} className="absolute bottom-2 left-2 p-1.5 bg-white/90 backdrop-blur rounded-full shadow-sm hover:scale-105 transition-transform opacity-0 group-hover:opacity-100 z-10">
              <Download className="w-4 h-4 text-black" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur rounded-full shadow-sm hover:scale-105 transition-transform opacity-0 group-hover:opacity-100 z-10">
              <X className="w-4 h-4 text-black" />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="aspect-[3/4] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors bg-gray-50">
            <Upload className="w-6 h-6 mb-2" />
            <span className="text-xs font-medium uppercase tracking-wider">Upload</span>
          </button>
        )}
        <input type="file" ref={fileRef} onChange={(e) => handleFileUpload(e, onUpload)} accept="image/*" className="hidden" />
      </div>
    );
  };

  if (isCheckingKey) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
            <Key className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h2 className="text-2xl font-light tracking-tight text-gray-900 mb-2">API Key Required</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              To use the high-quality model (gemini-3-pro-image-preview), you must select your own API key from a paid Google Cloud project.
            </p>
          </div>
          <button
            onClick={handleSelectKey}
            className="w-full py-4 bg-black text-white rounded-2xl font-medium flex items-center justify-center space-x-2 hover:bg-gray-800 transition-colors"
          >
            <span>Select API Key</span>
          </button>
          <p className="text-xs text-gray-400">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-gray-600">
              Billing Documentation
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans p-6 md:p-12 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        
        {/* Navigation Tabs */}
        <div className="flex space-x-8 mb-8 border-b border-gray-200 overflow-x-auto whitespace-nowrap">
          {['Lookbook Generator', 'Pose Extractor', 'The Mixer', 'Environment'].map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx + 1)}
              className={`pb-4 px-2 text-sm font-medium transition-colors relative ${
                activeTab === idx + 1 ? 'text-black' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab}
              {activeTab === idx + 1 && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
              )}
            </button>
          ))}
        </div>

        {/* Tab 1: Lookbook Generator */}
        {activeTab === 1 && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-12">
            <div className="xl:col-span-4 flex flex-col space-y-8">
              <div>
                <h1 className="text-3xl font-light tracking-tight text-gray-900 mb-3">Lookbook Generator</h1>
                <p className="text-gray-500 leading-relaxed text-sm">
                  Generate 2 variants of fashion lookbooks with detailed callouts. Select your favorite to use in The Mixer.
                </p>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest">Visual Ideas *</label>
                  <textarea
                    value={t1VisualIdeas}
                    onChange={(e) => setT1VisualIdeas(e.target.value)}
                    placeholder="e.g., minimalist oversized black suit, chunky sneakers, silver chain..."
                    className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none text-gray-800 placeholder-gray-400 text-sm"
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest">Context / Occasion</label>
                  <input
                    type="text"
                    value={t1Occasion}
                    onChange={(e) => setT1Occasion(e.target.value)}
                    placeholder="e.g., Paris Fashion Week..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent transition-all text-gray-800 placeholder-gray-400 text-sm"
                  />
                </div>
                {t1Error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{t1Error}</div>}
                <button
                  onClick={handleGenerateT1}
                  disabled={t1IsGenerating}
                  className="w-full py-4 bg-black text-white rounded-2xl font-medium flex items-center justify-center space-x-2 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {t1IsGenerating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /><span>Generating 2 variants...</span></>
                  ) : (
                    <><Wand2 className="w-5 h-5" /><span>Generate Lookbook</span></>
                  )}
                </button>
              </div>
            </div>
            <div className="xl:col-span-8 flex flex-col items-center justify-center min-h-[600px] bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative p-6 md:p-8">
              <AnimatePresence mode="wait">
                {t1IsGenerating ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center space-y-6 text-gray-400 my-auto">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-gray-100 rounded-full"></div>
                      <div className="w-20 h-20 border-4 border-black rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                    </div>
                    <p className="text-xs uppercase tracking-widest font-semibold text-gray-500 text-center">Designing lookbooks...</p>
                  </motion.div>
                ) : t1GeneratedImages.length > 0 ? (
                  <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-6">
                    {t1GeneratedImages.map((img, idx) => (
                      <div key={idx} className="relative group bg-[#f9f9f9] rounded-2xl flex items-center justify-center p-4 border border-gray-100">
                        <img
                          src={img}
                          alt={`Variant ${idx + 1}`}
                          className="max-w-full max-h-[500px] object-contain rounded-xl shadow-sm cursor-zoom-in"
                          onClick={() => setLightboxImg(img)}
                        />
                        <button onClick={(e) => { e.stopPropagation(); downloadImage(img, `lookbook-variant-${idx + 1}.png`); }} className="absolute bottom-6 left-6 p-2 bg-white/90 backdrop-blur rounded-full shadow-sm hover:scale-105 transition-transform opacity-0 group-hover:opacity-100">
                          <Download className="w-5 h-5 text-black" />
                        </button>
                        <button
                          onClick={() => setLookbookImg(lookbookImg === img ? null : img)}
                          className="absolute top-6 right-6 p-2 bg-white/90 backdrop-blur rounded-full shadow-sm hover:scale-105 transition-transform"
                        >
                          {lookbookImg === img ? <CheckCircle2 className="w-6 h-6 text-black" /> : <Circle className="w-6 h-6 text-gray-400" />}
                        </button>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-4 text-gray-300 my-auto">
                    <ImageIcon className="w-16 h-16 stroke-[1.5]" />
                    <p className="text-xs uppercase tracking-widest font-semibold text-center">Your generated variants<br/>will appear here</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Tab 2: Pose Extractor */}
        {activeTab === 2 && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-12">
            <div className="xl:col-span-4 flex flex-col space-y-8">
              <div>
                <h1 className="text-3xl font-light tracking-tight text-gray-900 mb-3">Pose Extractor</h1>
                <p className="text-gray-500 leading-relaxed text-sm">
                  Upload an image to extract the character's pose as a wooden mannequin sketch. Select it to use in The Mixer.
                </p>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest">Source Image *</label>
                  {t2SourceImg ? (
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-200 group">
                      <img
                        src={t2SourceImg}
                        className="w-full h-full object-cover cursor-zoom-in"
                        alt="Source"
                        onClick={() => setLightboxImg(t2SourceImg)}
                      />
                      <button onClick={(e) => { e.stopPropagation(); downloadImage(t2SourceImg, 'source-image.png'); }} className="absolute bottom-2 left-2 p-1.5 bg-white/90 backdrop-blur rounded-full shadow-sm hover:scale-105 transition-transform opacity-0 group-hover:opacity-100 z-10">
                        <Download className="w-4 h-4 text-black" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setT2SourceImg(null); }} className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur rounded-full shadow-sm hover:scale-105 transition-transform opacity-0 group-hover:opacity-100 z-10">
                        <X className="w-4 h-4 text-black" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => t2FileRef.current?.click()} className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors bg-gray-50">
                      <Upload className="w-8 h-8 mb-3" />
                      <span className="text-sm font-medium uppercase tracking-wider">Upload Image</span>
                    </button>
                  )}
                  <input type="file" ref={t2FileRef} onChange={(e) => handleFileUpload(e, setT2SourceImg)} accept="image/*" className="hidden" />
                </div>
                {t2Error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{t2Error}</div>}
                <button
                  onClick={handleGenerateT2}
                  disabled={t2IsGenerating || !t2SourceImg}
                  className="w-full py-4 bg-black text-white rounded-2xl font-medium flex items-center justify-center space-x-2 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {t2IsGenerating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /><span>Extracting Pose...</span></>
                  ) : (
                    <><Wand2 className="w-5 h-5" /><span>Extract Pose</span></>
                  )}
                </button>
              </div>
            </div>
            <div className="xl:col-span-8 flex flex-col items-center justify-center min-h-[600px] bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative p-6 md:p-8">
              <AnimatePresence mode="wait">
                {t2IsGenerating ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center space-y-6 text-gray-400 my-auto">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-gray-100 rounded-full"></div>
                      <div className="w-20 h-20 border-4 border-black rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                    </div>
                    <p className="text-xs uppercase tracking-widest font-semibold text-gray-500 text-center">Extracting pose and lookbook...</p>
                  </motion.div>
                ) : (t2GeneratedPose && t2GeneratedLookbook) ? (
                  <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative group bg-[#f9f9f9] rounded-2xl flex flex-col items-center justify-center p-4 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">scene_draft.png</p>
                      <img
                        src={t2GeneratedPose}
                        alt="Pose Sketch"
                        className="max-w-full max-h-[450px] object-contain rounded-xl shadow-sm cursor-zoom-in"
                        onClick={() => setLightboxImg(t2GeneratedPose)}
                      />
                      <button onClick={(e) => { e.stopPropagation(); downloadImage(t2GeneratedPose, 'scene_draft.png'); }} className="absolute bottom-6 left-6 p-2 bg-white/90 backdrop-blur rounded-full shadow-sm hover:scale-105 transition-transform opacity-0 group-hover:opacity-100">
                        <Download className="w-5 h-5 text-black" />
                      </button>
                    </div>
                    <div className="relative group bg-[#f9f9f9] rounded-2xl flex flex-col items-center justify-center p-4 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">extracted_lookbook.png</p>
                      <img
                        src={t2GeneratedLookbook}
                        alt="Extracted Lookbook"
                        className="max-w-full max-h-[450px] object-contain rounded-xl shadow-sm cursor-zoom-in"
                        onClick={() => setLightboxImg(t2GeneratedLookbook)}
                      />
                      <button onClick={(e) => { e.stopPropagation(); downloadImage(t2GeneratedLookbook, 'extracted_lookbook.png'); }} className="absolute bottom-6 left-6 p-2 bg-white/90 backdrop-blur rounded-full shadow-sm hover:scale-105 transition-transform opacity-0 group-hover:opacity-100">
                        <Download className="w-5 h-5 text-black" />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-4 text-gray-300 my-auto">
                    <ImageIcon className="w-16 h-16 stroke-[1.5]" />
                    <p className="text-xs uppercase tracking-widest font-semibold text-center">Extracted pose and lookbook<br/>will appear here</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Tab 3: The Mixer */}
        {activeTab === 3 && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-12">
            <div className="xl:col-span-5 flex flex-col space-y-8">
              <div>
                <h1 className="text-3xl font-light tracking-tight text-gray-900 mb-3">The Mixer</h1>
                <p className="text-gray-500 leading-relaxed text-sm">
                  Combine your Lookbook, Pose, and Model images to generate the final stylized result.
                </p>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <ImageSlot title="Lookbook" image={lookbookImg} onUpload={setLookbookImg} onRemove={() => setLookbookImg(null)} />
                  <ImageSlot title="Pose" image={poseImg} onUpload={setPoseImg} onRemove={() => setPoseImg(null)} />
                  <ImageSlot title="Model *" image={modelImg} onUpload={setModelImg} onRemove={() => setModelImg(null)} />
                </div>
                <div className="flex items-center space-x-3 py-2">
                  <input
                    type="checkbox"
                    id="headSwapToggle"
                    checked={t3HeadSwapOnly}
                    onChange={(e) => setT3HeadSwapOnly(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black transition-all cursor-pointer"
                  />
                  <label htmlFor="headSwapToggle" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                    Head Swap Only (Preserve Reference Body)
                  </label>
                </div>
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest">Environment & Specific Details</label>
                  <textarea
                    value={t3Environment}
                    onChange={(e) => setT3Environment(e.target.value)}
                    placeholder="e.g., background location, lighting mood, or specific small elements..."
                    className="w-full h-24 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none text-gray-800 placeholder-gray-400 text-sm"
                  />
                </div>
                {t3Error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{t3Error}</div>}
                <button
                  onClick={handleGenerateT3}
                  disabled={t3IsGenerating || !lookbookImg || !poseImg || !modelImg}
                  className="w-full py-4 bg-black text-white rounded-2xl font-medium flex items-center justify-center space-x-2 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {t3IsGenerating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /><span>Mixing Images...</span></>
                  ) : (
                    <><Wand2 className="w-5 h-5" /><span>Generate Final Image</span></>
                  )}
                </button>
              </div>
            </div>
            <div className="xl:col-span-7 flex flex-col items-center justify-center min-h-[600px] bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative p-6 md:p-8">
              <AnimatePresence mode="wait">
                {t3IsGenerating ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center space-y-6 text-gray-400 my-auto">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-gray-100 rounded-full"></div>
                      <div className="w-20 h-20 border-4 border-black rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                    </div>
                    <p className="text-xs uppercase tracking-widest font-semibold text-gray-500 text-center">Blending references...</p>
                  </motion.div>
                ) : t3GeneratedImage ? (
                  <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full flex items-center justify-center bg-[#f9f9f9] rounded-2xl relative group">
                    <img
                      src={t3GeneratedImage}
                      alt="Final Mix"
                      className="max-w-full max-h-[600px] object-contain rounded-xl shadow-sm cursor-zoom-in"
                      onClick={() => setLightboxImg(t3GeneratedImage)}
                    />
                    <button onClick={(e) => { e.stopPropagation(); downloadImage(t3GeneratedImage, 'final-mix.png'); }} className="absolute bottom-6 left-6 p-2 bg-white/90 backdrop-blur rounded-full shadow-sm hover:scale-105 transition-transform opacity-0 group-hover:opacity-100">
                      <Download className="w-5 h-5 text-black" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-4 text-gray-300 my-auto">
                    <ImageIcon className="w-16 h-16 stroke-[1.5]" />
                    <p className="text-xs uppercase tracking-widest font-semibold text-center">Final mixed image<br/>will appear here</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Tab 4: Environment Compositor */}
        {activeTab === 4 && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-12">
            {/* Left Panel: Controls */}
            <div className="xl:col-span-4 flex flex-col space-y-8">
              <div>
                <h1 className="text-3xl font-light tracking-tight text-gray-900 mb-3">Environment</h1>
                <p className="text-gray-500 leading-relaxed text-sm">
                  Place your character into a new targeted environment with realistic lighting and shadows.
                </p>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                {/* Environment Reference Upload */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest">Environment Reference Image</label>
                  {t4EnvRefImg ? (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-gray-200 group">
                      <img
                        src={t4EnvRefImg}
                        className="w-full h-full object-cover cursor-zoom-in"
                        alt="Env Reference"
                        onClick={() => setLightboxImg(t4EnvRefImg)}
                      />
                      <button onClick={(e) => { e.stopPropagation(); downloadImage(t4EnvRefImg, 'env-reference.png'); }} className="absolute bottom-2 left-2 p-1.5 bg-white/90 backdrop-blur rounded-full shadow-sm hover:scale-105 transition-transform opacity-0 group-hover:opacity-100 z-10">
                        <Download className="w-4 h-4 text-black" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setT4EnvRefImg(null); }} className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur rounded-full shadow-sm hover:scale-105 transition-transform opacity-0 group-hover:opacity-100 z-10">
                        <X className="w-4 h-4 text-black" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => t4FileRef.current?.click()} className="w-full aspect-video rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors bg-gray-50">
                      <Upload className="w-6 h-6 mb-2" />
                      <span className="text-xs font-medium uppercase tracking-wider">Upload Reference</span>
                    </button>
                  )}
                  <input type="file" ref={t4FileRef} onChange={(e) => handleFileUpload(e, setT4EnvRefImg)} accept="image/*" className="hidden" />
                </div>

                {/* Text Input */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest">Environment Details & Prompts</label>
                  <textarea
                    value={t4EnvDetails}
                    onChange={(e) => setT4EnvDetails(e.target.value)}
                    placeholder="e.g., golden hour, cinematic shadows, futuristic city background..."
                    className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none text-gray-800 placeholder-gray-400 text-sm leading-relaxed"
                  />
                </div>

                {t4Error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{t4Error}</div>}
                
                <button
                  onClick={handleAnalyzeT4}
                  disabled={t4IsGenerating || !t3GeneratedImage}
                  className="w-full py-4 bg-black text-white rounded-2xl font-medium flex items-center justify-center space-x-2 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {t4IsGenerating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /><span>Generating Composition...</span></>
                  ) : (
                    <><Wand2 className="w-5 h-5" /><span>Generate Composition</span></>
                  )}
                </button>
              </div>
            </div>

            {/* Right Panel: Main View */}
            <div className="xl:col-span-8 flex flex-col items-center justify-center min-h-[600px] bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative p-6 md:p-8">
              <AnimatePresence mode="wait">
                {t4IsGenerating ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center space-y-6 text-gray-400 my-auto">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-gray-100 rounded-full"></div>
                      <div className="w-20 h-20 border-4 border-black rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                    </div>
                    <p className="text-xs uppercase tracking-widest font-semibold text-gray-500 text-center">Compositing scene...</p>
                  </motion.div>
                ) : t4GeneratedImg ? (
                  <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full flex items-center justify-center bg-[#f9f9f9] rounded-2xl relative group">
                    <img
                      src={t4GeneratedImg}
                      alt="Final Composition"
                      className="max-w-full max-h-[600px] object-contain rounded-xl shadow-sm cursor-zoom-in"
                      onClick={() => setLightboxImg(t4GeneratedImg)}
                    />
                    <button onClick={(e) => { e.stopPropagation(); downloadImage(t4GeneratedImg, 'final-composition.png'); }} className="absolute bottom-6 left-6 p-2 bg-white/90 backdrop-blur rounded-full shadow-sm hover:scale-105 transition-transform opacity-0 group-hover:opacity-100">
                      <Download className="w-5 h-5 text-black" />
                    </button>
                  </motion.div>
                ) : t3GeneratedImage ? (
                  <motion.div key="subject" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full flex flex-col items-center justify-center space-y-4">
                    <div className="relative group bg-[#f9f9f9] rounded-2xl flex items-center justify-center p-4 border border-gray-100 max-w-md w-full">
                      <img
                        src={t3GeneratedImage}
                        alt="Working Subject"
                        className="max-w-full max-h-[500px] object-contain rounded-xl shadow-sm cursor-zoom-in"
                        onClick={() => setLightboxImg(t3GeneratedImage)}
                      />
                      <p className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-widest bg-black text-white px-2 py-1 rounded">Working Subject</p>
                    </div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Ready for composition</p>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-4 text-gray-300 my-auto">
                    <ImageIcon className="w-16 h-16 stroke-[1.5]" />
                    <p className="text-xs uppercase tracking-widest font-semibold text-center">No final image found.<br/>Please generate an image in The Mixer first.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        <Lightbox />
      </div>
    </div>
  );
}
