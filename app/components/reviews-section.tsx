"use client";

import { Search, Fingerprint } from "lucide-react";

export function ReviewsSection() {
  return (
    <section className="relative flex flex-col items-center justify-center overflow-hidden pt-0 pb-12 md:pt-2 md:pb-20">
      {/* Background Icons */}
      <div className="absolute left-10 top-24 hidden rotate-12 opacity-10 pointer-events-none xl:block">
        <Search className="h-32 w-32 text-white" />
      </div>
      <div className="absolute bottom-10 right-20 hidden -rotate-12 opacity-10 pointer-events-none xl:block">
        <Fingerprint className="h-32 w-32 text-white" />
      </div>
      <svg className="absolute left-10 top-1/2 hidden h-32 w-32 opacity-20 pointer-events-none xl:block" viewBox="0 0 100 100">
        <path d="M10,50 Q30,10 50,50 T90,50" fill="none" stroke="white" strokeDasharray="5,5" strokeWidth="2"></path>
        <path d="M10,60 Q30,20 50,60 T90,60" fill="none" stroke="white" strokeDasharray="3,7" strokeWidth="2"></path>
      </svg>

      <div className="relative z-10 mb-8 rotate-random-3">
        <div className="inline-block rounded-full border-4 border-black bg-[#F8F1E1] px-6 py-2 shadow-[4px_4px_0px_0px_#000000]">
          <span className="font-display text-xl uppercase tracking-widest text-[#1C1C1C]">Field Reports</span>
        </div>
      </div>

      <h2 className="z-10 mb-16 text-center font-display text-4xl tracking-wide text-[#F8F1E1] drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] md:text-6xl">
        Evidence from the{" "}
        <span className="relative inline-block">
          Field
          <svg className="absolute -bottom-1 left-0 h-3 w-full text-[#F4E06D]" preserveAspectRatio="none" viewBox="0 0 100 10">
            <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="6"></path>
          </svg>
        </span>
      </h2>

      <div className="relative z-10 grid w-full max-w-7xl grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Polaroid */}
        <div className="group relative rotate-random-1 transition-transform duration-300 ease-out hover:scale-105">
          <div className="pin bg-red-600"></div>
          <div className="border border-gray-200 bg-white p-4 pb-12 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.5)]">
            <div className="relative mb-4 aspect-square overflow-hidden border border-gray-300 bg-gray-100 grayscale contrast-125">
              <img alt="Investigator portrait" className="h-full w-full object-cover opacity-90 mix-blend-multiply" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCc9Rl951lvU5nO6bd9gMPdI2frUpqcmBbH6xYssXa5bix8riajhgdIaNvIhqTEiht4n1_RpnJXY14YdVBw3qb0vvlJrsDVVT0PWzbUjFHBZe9SrEjjdDyaxpqUzUY2JHx74_eAjGneki1j7htYJhfD-Duo1tX6xfEPvPJzrC8d7hRIZBvCDFREPLBiZG8V8qIyA6R-2KAmMiGXbWlqR3IgxOwkmYKlWGzuqLhRSE6hnJUCTvrIIDhXKeFYDfn9DnnmCc6GJcl_pdI" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
            <div className="mb-2 -rotate-1 font-hand text-xl text-blue-900">"Found the deepfake in seconds."</div>
            <div className="mt-2 flex items-center justify-between border-t border-gray-300 pt-2 font-courier text-xs text-gray-500">
              <span>CASE #8921</span>
              <span className="font-bold">DET. MARCUS R.</span>
            </div>
          </div>
        </div>

        {/* Card 2: Sticky Note */}
        <div className="group relative mt-8 rotate-random-2 transition-transform duration-300 ease-out hover:scale-105 md:mt-0">
          <div className="absolute -top-4 left-1/2 z-20 h-8 w-24 -translate-x-1/2 rotate-2 border-l border-r border-white/20 bg-yellow-100/60 backdrop-blur-sm"></div>
          <div className="relative flex min-h-[300px] flex-col overflow-hidden bg-[#F4E06D] p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.5)]">
            <div className="pointer-events-none absolute left-0 top-0 h-full w-full opacity-10" style={{ backgroundImage: "linear-gradient(#999 1px, transparent 1px)", backgroundSize: "100% 24px" }}></div>
            <div className="coffee-stain -bottom-4 -right-4 h-24 w-24 border-8 border-yellow-700/10"></div>
            <p className="relative z-10 mb-6 font-body text-lg leading-loose text-gray-800">
              <span className="mr-2 float-left font-display text-2xl font-bold">SUBJECT:</span> 
              Analysis Speed.<br/><br/>
              Cipher Sleuth is the missing link in our forensic pipeline. The ELA noise analysis cleared a high-profile fraud case yesterday. Unprecedented accuracy.
            </p>
            <div className="relative z-10 mt-auto">
              <div className="mb-2 h-1 w-32 rounded-full bg-gray-800 opacity-80"></div>
              <p className="font-display text-sm uppercase tracking-widest text-[#1C1C1C]">Sarah Jenkins</p>
              <p className="font-courier text-xs text-gray-600">Chief Forensics Officer</p>
            </div>
          </div>
        </div>

        {/* Card 3: Paper Clipped Note */}
        <div className="group relative mt-4 rotate-random-3 transition-transform duration-300 ease-out hover:scale-105 md:mt-12">
          <div className="paper-clip"></div>
          <div className="relative border-4 border-black bg-[#F8F1E1] p-6 shadow-[4px_4px_0px_0px_#000000]">
            <div className="absolute right-4 top-4 -rotate-12 border-2 border-red-700 px-2 py-1 font-display text-xs font-bold uppercase text-red-700 opacity-70">Verified</div>
            <div className="mb-4 flex items-center gap-3 border-b-2 border-dashed border-black pb-2">
              <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-black bg-gray-300">
                <img alt="Expert Avatar" className="h-full w-full object-cover grayscale" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDl5krS84Dw4WMi2RJJJpAjL9kYFNb1n2L69Gz37_AltKj2jdhdAx2DFXcuKg5y7L1RUAHyarImhAiZkkO5-lDf2n3kWkukVptETWGKJib2YG1EQpoq6a5bb14KLHX4aIPJsxbX8yN_bqphSaPmF-K1dfIjskThJgo2J-CzHl1AXCr8yedCFnskjm2QFgq2pljG8EGWOUVDjIGiCBvqpk6xD2DV8iRboj9UFKp_Fqa6CnCBbbAgtiSohVwLqv6oatTB4RALNsseGMI" />
              </div>
              <div>
                <h4 className="font-display text-lg uppercase leading-none text-[#1C1C1C]">Dr. A. Vance</h4>
                <span className="font-courier text-xs text-gray-500">Cybersecurity Consultant</span>
              </div>
            </div>
            <p className="mb-4 font-courier text-sm leading-relaxed text-[#1C1C1C]">
              [TRANSCRIPT START]<br/>
              "The metadata drift detection is incredibly sensitive. It flagged an edited timestamp that three other tools missed completely. Essential kit."<br/>
              [TRANSCRIPT END]
            </p>
            <div className="mt-4 flex gap-2">
              <span className="rounded bg-black px-2 py-0.5 font-courier text-[10px] text-white">#METADATA</span>
              <span className="rounded bg-black px-2 py-0.5 font-courier text-[10px] text-white">#INTEGRITY</span>
            </div>
          </div>
        </div>

        {/* Card 4: Lined Paper Note */}
        <div className="group relative hidden rotate-random-2 transition-transform duration-300 ease-out hover:scale-105 lg:block">
          <div className="pin bg-blue-500"></div>
          <div className="relative h-full border-t-4 border-red-500 bg-white bg-[url('https://www.transparenttextures.com/patterns/lined-paper.png')] p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.5)]">
            <h3 className="mb-2 border-b border-red-200 pb-1 font-display text-xl uppercase text-gray-800">Case Note: 1044</h3>
            <p className="transform -rotate-1 font-hand text-xl leading-relaxed text-blue-800">
              Don't start another audit without running the images through the CS API first. Saved us 40 hours this week alone.
            </p>
            <div className="absolute bottom-4 right-4 text-right">
              <p className="font-courier text-xs uppercase tracking-widest text-gray-400">Signed,</p>
              <p className="font-display text-md text-[#1C1C1C]">James Wu</p>
            </div>
          </div>
        </div>

        {/* Card 5: Jagged Edge Note */}
        <div className="group relative hidden -rotate-1 transition-transform duration-300 ease-out hover:scale-105 md:col-span-2 md:block lg:col-span-1 lg:block">
          <div className="clip-path-jagged relative bg-[#e8e8e8] p-6 shadow-[4px_4px_0px_0px_#000000]">
            <div className="absolute left-1/2 top-2 h-4 w-4 -translate-x-1/2 rounded-full border border-gray-500 bg-gray-400 shadow-inner"></div>
            <p className="mb-4 mt-4 text-justify font-courier text-sm tracking-tight text-[#1C1C1C]">
              "CIPHER SLEUTH IDENTIFIED SYNTHETIC PATTERNS IN THE EVIDENCE THAT WERE INVISIBLE TO THE NAKED EYE. GAME CHANGER."
            </p>
            <div className="flex items-end justify-between border-t-2 border-dashed border-gray-400 pt-2">
              <div>
                <p className="font-display text-lg uppercase font-bold text-[#1C1C1C]">Elena R.</p>
                <p className="font-courier text-xs text-[#1C1C1C]">Digital Forensic Analyst</p>
              </div>
              <div className="text-2xl opacity-20">
                <Fingerprint className="h-8 w-8 text-[#1C1C1C]" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 6: Internal Memo */}
        <div className="group relative hidden rotate-2 transition-transform duration-300 ease-out hover:scale-105 md:block">
          <div className="pin bg-green-600"></div>
          <div className="border border-yellow-200 bg-yellow-50 p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.5)]">
            <div className="mb-2 border-b border-gray-200 pb-2 font-courier text-xs uppercase tracking-widest text-gray-400">Internal Memo</div>
            <p className="mb-4 font-body text-base text-gray-800">
              "The pixel integrity layer is my go-to first check. It's like having a superpower for spotting clones."
            </p>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-white">TK</div>
              <span className="font-courier text-xs font-bold text-[#1C1C1C]">Tom K. - Lead Investigator</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
