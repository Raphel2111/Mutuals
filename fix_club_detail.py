with open(r'c:\Users\Rafa\Desktop\MUTUALS\Mutuals\frontend_web\src\pages\ClubDetail.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the duplicate </div> blocks
content = content.replace(
'''                                    </div>
                                    </div>
                                )}''', 
'''                                    </div>
                                )}''')

content = content.replace(
'''                            </div>
                        </div>
                        </div>
            );''',
'''                            </div>
                        </div>
                    );''')

# Fix the Reply banner indentation/bracket issue
content = content.replace(
'''            {/* Reply banner */ }
    {
        replyTo && (''',
'''            {/* Reply banner */}
            {replyTo && (''')

content = content.replace(
'''            </div>
        )
    }

    {/* Image Preview Banner */ }
    {
        imagePreview && (''',
'''                </div>
            )}

            {/* Image Preview Banner */}
            {imagePreview && (''')

content = content.replace(
'''            </div>
        )
    }

    {/* Compose area */ }
    <div className="chat-compose">''',
'''                </div>
            )}

            {/* Compose area */}
            <div className="chat-compose">''')

content = content.replace(
'''        <button
            className="chat-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Adjuntar imagen"
        >
            📎
        </button>

        {/* @mention dropdown */ }
        {
            mentionQuery !== null && mentionCandidates.length > 0 && (''',
'''                <button
                    className="chat-attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Adjuntar imagen"
                >
                    📎
                </button>

                {/* @mention dropdown */}
                {mentionQuery !== null && mentionCandidates.length > 0 && (''')


content = content.replace(
'''                </div>
            )
        }
        <textarea''',
'''                    </div>
                )}
                <textarea''')

content = content.replace(
'''            rows={1}
        />
        <button className="chat-send-btn" onClick={submit} disabled={loading || (!content.trim() && !imageFile)}>
            {loading ? '…' : '➤'}
        </button>
    </div>
        </div >
    );
}''',
'''                    rows={1}
                />
                <button className="chat-send-btn" onClick={submit} disabled={loading || (!content.trim() && !imageFile)}>
                    {loading ? '…' : '➤'}
                </button>
            </div>
        </div>
    );
}''')


with open(r'c:\Users\Rafa\Desktop\MUTUALS\Mutuals\frontend_web\src\pages\ClubDetail.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed layout.')
