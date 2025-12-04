import '../styles/FAQPage.css'

const FAQPage: React.FC = () => {
  const faqs = [
    {
      id: 1,
      icon: '🚫',
      question: "You've hit your usage limit",
      answer: '账号的已达使用上限，请切换其他账号',
      type: 'error'
    },
    {
      id: 2,
      icon: '🌍',
      question: "This model provider doesn't serve your region.",
      answer: '地区限制 先打开魔法再打开cursor，cursor里设置http1.1',
      type: 'warning'
    },
    {
      id: 3,
      icon: '📡',
      question: 'Connection failed. If the problem persists, please check your internet connection or VPN',
      answer: '魔法不稳定，换个好点的，（后续找到好用的再给你们推荐）',
      type: 'warning'
    },
    {
      id: 4,
      icon: '🛡️',
      question: 'Your request has been blocked as our system has detected suspicious activity from your account.',
      answer: '首先尝试切换魔法\n\n然后切换o3模型对话几次\n\n切换原模型尝试\n\n以上步骤不行，则换号。魔法要稳定',
      type: 'error',
      steps: [
        '首先尝试切换魔法',
        '然后切换o3模型对话几次',
        '切换原模型尝试',
        '以上步骤不行，则换号。魔法要稳定'
      ]
    },
    {
      id: 5,
      icon: '⏳',
      question: "We're experiencing high demand for Claude4 sonnet right now. Please upgrade to Pro, switch to the 'auto' model, another model, or try again in a few moments",
      answer: 'Claude4 高峰期时限制了试用版pro的使用，请重试或者选择C3.7 auto等模型',
      type: 'info'
    }
  ]

  return (
    <div className="faq-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">常见问题解决</h1>
          <p className="page-subtitle">Cursor 使用过程中的常见问题和解决方案</p>
        </div>
      </div>

      <div className="page-content">
        <div className="faq-list">
          {faqs.map((faq) => (
            <div key={faq.id} className={`faq-card faq-${faq.type}`}>
              <div className="faq-header">
                <div className="faq-icon">{faq.icon}</div>
                <div className="faq-number">问题 {faq.id}</div>
              </div>
              
              <div className="faq-content">
                <h3 className="faq-question">
                  <span className="question-label">问题：</span>
                  {faq.question}
                </h3>
                
                <div className="faq-answer">
                  <span className="answer-label">解决方案：</span>
                  {faq.steps ? (
                    <ol className="answer-steps">
                      {faq.steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="answer-text">{faq.answer}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 提示卡片 */}
        <div className="tips-card">
          <div className="tips-header">
            <span className="tips-icon">💡</span>
            <h3 className="tips-title">温馨提示</h3>
          </div>
          <div className="tips-content">
            <p>• 遇到问题时，首先尝试切换账号或刷新用量</p>
            <p>• 使用魔法时，建议选择稳定的节点</p>
            <p>• Pro 账号相比 Free 账号有更高的使用优先级</p>
            <p>• 定期检查账号用量，避免超限</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FAQPage


