import React, { useMemo } from 'react'
import styled from 'styled-components'
import { amberA100 } from '../styles/colors'
import { body2 } from '../styles/typography'
import { ConnectedUsername } from './connected-username'
import {
  InfoImportant,
  SeparatedInfoMessage,
  Separator,
  TimestampMessageLayout,
} from './message-layout'

const URL_REGEX = /(?<g1>https?:\/\/)(?:[^\s)"\].]|(?:\.(?=\S))|(?<=\k<g1>.*\([^)]*)\)){2,}/gi

const newDayFormat = new Intl.DateTimeFormat(navigator.language, {
  year: 'numeric',
  month: 'long',
  day: '2-digit',
})

const Username = styled.span`
  ${body2};

  margin-right: 8px;

  color: ${amberA100};
  line-height: inherit;
`

const Text = styled.span`
  line-height: inherit;
  word-wrap: break-word;
  overflow-wrap: break-word;
  overflow: hidden;
`

export function ParsedText({ text }: { text: string }) {
  const parsedText = useMemo(() => {
    const matches = text.matchAll(URL_REGEX)
    const elements = []
    let lastIndex = 0

    for (const match of matches) {
      // Insert preceding text, if any
      if (match.index! > lastIndex) {
        elements.push(text.substring(lastIndex, match.index))
      }

      elements.push(
        // TODO(2Pac): Show a warning message about opening untrusted links
        <a key={match.index} href={match[0]} target='_blank' rel='noopener'>
          {match[0]}
        </a>,
      )

      lastIndex = match.index! + match[0].length
    }

    // Insert remaining text, if any
    if (text.length > lastIndex) {
      elements.push(text.substring(lastIndex))
    }

    return elements
  }, [text])

  return <Text>{parsedText}</Text>
}

export const TextMessageDisplay = React.memo<{ userId: number; time: number; text: string }>(
  props => {
    const { userId, time, text } = props
    return (
      <TimestampMessageLayout time={time}>
        <Username>
          <ConnectedUsername userId={userId} />
        </Username>
        <Separator aria-hidden={true}>{': '}</Separator>
        <ParsedText text={text} />
      </TimestampMessageLayout>
    )
  },
)

export const NewDayMessage = React.memo<{ time: number }>(props => {
  const { time } = props
  return (
    <SeparatedInfoMessage>
      <span>
        Day changed to <InfoImportant>{newDayFormat.format(time)}</InfoImportant>
      </span>
    </SeparatedInfoMessage>
  )
})
