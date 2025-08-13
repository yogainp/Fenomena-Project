'use client';

import Link from 'next/link';

export default function MetadataInsightPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/insight-fenomena" className="text-xl font-semibold text-blue-600 hover:text-blue-800">
                ← Kembali ke Insight Fenomena
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Metadata Insight</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Dokumentasi Sistem Scoring Insight Fenomena</h1>
            <p className="mt-2 text-sm text-gray-600">
              Penjelasan mendalam tentang algoritma dan metodologi yang digunakan dalam analisis fenomena
            </p>
            
            {/* Breadcrumb */}
            <nav className="mt-4 flex" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-1 md:space-x-3">
                <li className="inline-flex items-center">
                  <Link href="/dashboard" className="text-gray-700 hover:text-blue-600">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <div className="flex items-center">
                    <span className="mx-2 text-gray-400">/</span>
                    <Link href="/insight-fenomena" className="text-gray-700 hover:text-blue-600">
                      Insight Fenomena
                    </Link>
                  </div>
                </li>
                <li>
                  <div className="flex items-center">
                    <span className="mx-2 text-gray-400">/</span>
                    <span className="text-gray-500">Metadata Insight</span>
                  </div>
                </li>
              </ol>
            </nav>
          </div>

          {/* Content Sections */}
          <div className="space-y-8">
            
            {/* Section 1: Sistem Scoring */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">📊 Penjelasan Sistem Scoring</h2>
                
                <div className="space-y-6">
                  {/* Validasi Media */}
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">1. Validasi Media (validationStrength)</h3>
                    <div className="bg-gray-50 p-4 rounded-lg mb-3">
                      <p className="text-sm text-gray-700 mb-2"><strong>Cara Kerja:</strong> Dihitung berdasarkan jumlah berita berkorelasi yang ditemukan</p>
                      <div className="bg-white p-3 rounded border">
                        <code className="text-sm text-blue-600">
                          validationStrength = Math.min(100, correlatedNews.length * 20)
                        </code>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Interpretasi:</strong> Setiap berita berkorelasi memberikan 20 poin, maksimal 100 poin
                      </p>
                    </div>
                  </div>

                  {/* Minat Publik */}
                  <div className="border-l-4 border-green-500 pl-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">2. Minat Publik (publicInterest)</h3>
                    <div className="bg-gray-50 p-4 rounded-lg mb-3">
                      <p className="text-sm text-gray-700 mb-2"><strong>Cara Kerja:</strong> Rata-rata skor relevansi dari semua berita berkorelasi</p>
                      <div className="bg-white p-3 rounded border">
                        <code className="text-sm text-green-600">
                          publicInterest = Math.min(100, totalRelevanceScore / 5)
                        </code>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Interpretasi:</strong> Semakin tinggi relevansi berita, semakin tinggi minat publik
                      </p>
                    </div>
                  </div>

                  {/* Keselarasan Sentimen */}
                  <div className="border-l-4 border-purple-500 pl-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">3. Keselarasan Sentimen (sentimentAlignment)</h3>
                    <div className="bg-gray-50 p-4 rounded-lg mb-3">
                      <p className="text-sm text-gray-700 mb-2"><strong>Cara Kerja:</strong> Mengukur keselarasan sentimen antara fenomena, berita, dan catatan survei</p>
                      <div className="bg-white p-3 rounded border">
                        <code className="text-sm text-purple-600">
                          alignmentScore = 100 - (|newsPositiveRatio - surveyPositiveRatio| * 50 + |newsNegativeRatio - surveyNegativeRatio| * 50)
                        </code>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Interpretasi:</strong> Semakin selaras sentimen semua sumber, semakin tinggi skornya
                      </p>
                    </div>
                  </div>

                  {/* Diversitas Bukti */}
                  <div className="border-l-4 border-orange-500 pl-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">4. Diversitas Bukti (evidenceDiversity)</h3>
                    <div className="bg-gray-50 p-4 rounded-lg mb-3">
                      <p className="text-sm text-gray-700 mb-2"><strong>Cara Kerja:</strong> Dihitung berdasarkan jumlah portal berita unik yang memberitakan</p>
                      <div className="bg-white p-3 rounded border">
                        <code className="text-sm text-orange-600">
                          evidenceDiversity = Math.min(100, uniquePortalCount * 35)
                        </code>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Interpretasi:</strong> Semakin banyak portal berbeda, semakin tinggi diversitas bukti
                      </p>
                    </div>
                  </div>

                  {/* Overall Score */}
                  <div className="border-l-4 border-red-500 pl-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">5. Overall Score</h3>
                    <div className="bg-gray-50 p-4 rounded-lg mb-3">
                      <p className="text-sm text-gray-700 mb-2"><strong>Cara Kerja:</strong> Weighted average dari keempat komponen</p>
                      <div className="bg-white p-3 rounded border">
                        <code className="text-sm text-red-600">
                          overallScore = (validationStrength * 0.3 + publicInterest * 0.25 + sentimentAlignment * 0.25 + evidenceDiversity * 0.2)
                        </code>
                      </div>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="bg-blue-100 p-2 rounded text-center">
                          <div className="font-bold text-blue-800">Validasi Media</div>
                          <div className="text-blue-600">30%</div>
                        </div>
                        <div className="bg-green-100 p-2 rounded text-center">
                          <div className="font-bold text-green-800">Minat Publik</div>
                          <div className="text-green-600">25%</div>
                        </div>
                        <div className="bg-purple-100 p-2 rounded text-center">
                          <div className="font-bold text-purple-800">Sentimen</div>
                          <div className="text-purple-600">25%</div>
                        </div>
                        <div className="bg-orange-100 p-2 rounded text-center">
                          <div className="font-bold text-orange-800">Diversitas</div>
                          <div className="text-orange-600">20%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Sistem Relevansi */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">🔍 Cara Sistem Menghitung Relevansi</h2>
                
                <div className="space-y-6">
                  {/* Keyword Extraction */}
                  <div className="border-l-4 border-indigo-500 pl-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">1. Keyword Extraction Process</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-700 mb-3"><strong>Algoritma:</strong></p>
                      <div className="bg-white p-4 rounded border mb-3">
                        <pre className="text-sm text-indigo-600 overflow-x-auto">
{`function extractKeywords(text) {
  // 1. Bersihkan teks (lowercase, hapus tanda baca)
  const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  
  // 2. Split menjadi kata-kata
  const words = cleanText.split(/\s+/);
  
  // 3. Filter berdasarkan kriteria:
  return words.filter(word => 
    word.length > 3 &&           // Minimal 4 karakter
    !stopWords.includes(word) && // Bukan stopword
    !word.match(/^\d+$/)         // Bukan angka murni
  );
}`}
                        </pre>
                      </div>
                      <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                        <p className="text-sm text-yellow-800">
                          <strong>Stopwords:</strong> 41 kata Bahasa Indonesia seperti: dan, yang, di, ke, dari, untuk, pada, dengan, dalam, oleh, adalah, ini, itu, dll.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sumber Keyword */}
                  <div className="border-l-4 border-cyan-500 pl-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">2. Sumber Keyword untuk Fenomena</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="bg-white p-3 rounded border">
                        <code className="text-sm text-cyan-600">
                          phenomenonKeywords = extractKeywords(`$&#123;phenomenon.title&#125; $&#123;phenomenon.description&#125;`)
                        </code>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Input:</strong> Gabungan judul dan deskripsi fenomena sebagai satu teks
                      </p>
                    </div>
                  </div>

                  {/* Keyword Overlap */}
                  <div className="border-l-4 border-teal-500 pl-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">3. Algoritma Keyword Overlap</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="bg-white p-4 rounded border mb-3">
                        <pre className="text-sm text-teal-600 overflow-x-auto">
{`function calculateKeywordOverlap(keywords1, keywords2) {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  
  // Kata yang sama (intersection)
  const intersection = new Set(
    [...set1].filter(x => set2.has(x))
  );
  
  // Total kata unik (union)
  const union = new Set([...set1, ...set2]);
  
  // Formula Jaccard Similarity
  return (intersection.size / union.size) * 100;
}`}
                        </pre>
                      </div>
                      <div className="bg-blue-50 p-3 rounded">
                        <p className="text-sm text-blue-800">
                          <strong>Formula:</strong> (Kata yang sama ÷ Total kata unik) × 100%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Relevance Score */}
                  <div className="border-l-4 border-pink-500 pl-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">4. Relevance Score Calculation</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="bg-white p-3 rounded border mb-3">
                        <code className="text-sm text-pink-600">
                          relevanceScore = keywordOverlap * 0.4 + temporalRelevance * 0.3 + geographicRelevance * 0.2 + sentimentMatch * 0.1
                        </code>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-3">
                        <div className="bg-pink-100 p-2 rounded text-center">
                          <div className="font-bold text-pink-800">Keyword</div>
                          <div className="text-pink-600">40%</div>
                        </div>
                        <div className="bg-purple-100 p-2 rounded text-center">
                          <div className="font-bold text-purple-800">Temporal</div>
                          <div className="text-purple-600">30%</div>
                        </div>
                        <div className="bg-indigo-100 p-2 rounded text-center">
                          <div className="font-bold text-indigo-800">Geographic</div>
                          <div className="text-indigo-600">20%</div>
                        </div>
                        <div className="bg-teal-100 p-2 rounded text-center">
                          <div className="font-bold text-teal-800">Sentiment</div>
                          <div className="text-teal-600">10%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Karakteristik & Improvement */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">⚡ Karakteristik & Improvement</h2>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Kelebihan */}
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h3 className="text-lg font-semibold text-green-900 mb-3">✅ Kelebihan Sistem</h3>
                    <ul className="space-y-2 text-sm text-green-800">
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span><strong>Otomatis:</strong> Tidak perlu manual define keyword</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span><strong>Fleksibel:</strong> Beradaptasi dengan konten apa pun</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span><strong>Komprehensif:</strong> Menggunakan seluruh teks fenomena</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span><strong>Multi-faktor:</strong> Kombinasi keyword, temporal, geografis, sentimen</span>
                      </li>
                    </ul>
                  </div>

                  {/* Kelemahan */}
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h3 className="text-lg font-semibold text-red-900 mb-3">❌ Kelemahan Sistem</h3>
                    <ul className="space-y-2 text-sm text-red-800">
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span><strong>Tidak ada bobot keyword:</strong> Semua kata dianggap sama penting</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span><strong>Stopwords terbatas:</strong> Hanya 41 kata Bahasa Indonesia</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span><strong>Tidak ada sinonim:</strong> "ekonomi" vs "perekonomian" berbeda</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span><strong>Geographic fixed:</strong> Selalu 75%, tidak dinamis</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Saran Improvement */}
                <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3">🚀 Saran Improvement</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li className="flex items-start">
                        <span className="mr-2">1.</span>
                        <span><strong>Weighted Keywords:</strong> Kata di judul lebih penting dari deskripsi</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">2.</span>
                        <span><strong>Stemming/Lemmatization:</strong> Mengenali bentuk dasar kata</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">3.</span>
                        <span><strong>Synonym Detection:</strong> Mengenali kata bersinonim</span>
                      </li>
                    </ul>
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li className="flex items-start">
                        <span className="mr-2">4.</span>
                        <span><strong>Domain-specific keywords:</strong> Kata kunci khusus sektor</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">5.</span>
                        <span><strong>Dynamic geographic scoring:</strong> Berdasarkan lokasi sebenarnya</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">6.</span>
                        <span><strong>Machine Learning:</strong> Adaptive scoring model</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}