#include "parserClass.hpp"

namespace Parser
{

    // Counts leading whitespace to determine indentation level
    int countIndent(const string &line)
    {
        int count = 0;

        // Iterates through characters until non-whitespace is found
        for (char c : line)
        {
            if (c == ' ')
                count++;
            else if (c == '\t')
                count += 4;
            else
                break;
        }
        return count;
    }

    // Removes leading and trailing whitespace
    string trim(const string &line)
    {

        // Finds first non-whitespace character
        size_t start = line.find_first_not_of(" \t\r\n");

        // If there are no non whitespace characters in the checked line, return
        if (start == string::npos)
            return "";

        // Finds last non-whitespace character
        size_t end = line.find_last_not_of(" \t\r\n");

        return line.substr(start, end - start + 1);
    }

    // Determines the start of each block
    bool startBlock(const string &line)
    {
        string s = trim(line);

        if (s.empty())
            return false;

        return !s.empty() && s[s.length() - 1] == ':';
    }

    // Determines the type of each block
    BlockType detectType(const string &line)
    {
        string s = trim(line);

        // Checks the line for any of the indicators of a new block
        if (s.rfind("class ", 0) == 0)
            return BlockType::CLASS;
        if (s.rfind("def ", 0) == 0)
            return BlockType::FUNCTION;
        if (s.rfind("if ", 0) == 0)
            return BlockType::IF;
        if (s.rfind("elif ", 0) == 0)
            return BlockType::ELIF;
        if (s.rfind("else", 0) == 0)
            return BlockType::ELSE;
        if (s.rfind("for ", 0) == 0)
            return BlockType::FOR;
        if (s.rfind("while ", 0) == 0)
            return BlockType::WHILE;
        if (s.rfind("try", 0) == 0)
            return BlockType::TRY;
        if (s.rfind("except", 0) == 0)
            return BlockType::EXCEPT;
        if (s.rfind("with ", 0) == 0)
            return BlockType::WITH;

        return BlockType::UNKNOWN;
    }

    // Reads the file and returns a vector of all block events
    vector<BlockEvent> parseFile(ifstream &file)
    {
        vector<BlockEvent> events;
        stack<ActiveBlock> blockStack;

        string line;
        int lineNumber = 0;

        // Read file line by line
        while (getline(file, line))
        {
            lineNumber++;

            int indentLevel = countIndent(line);
            string trimmed = trim(line);

            if (trimmed.empty())
                continue;

            // Handle dedents (close blocks)
            while (!blockStack.empty() && indentLevel < blockStack.top().indentLevel)
            {
                BlockEvent endEvent;
                endEvent.kind = EventKind::END;
                endEvent.type = blockStack.top().type;
                endEvent.lineNumber = lineNumber;
                endEvent.indentLevel = indentLevel;
                endEvent.lineText = trimmed;

                events.push_back(endEvent);

                blockStack.pop();
            }

            // Determine current active block (smallest enclosing block)
            BlockType activeType = BlockType::UNKNOWN;
            if (!blockStack.empty())
            {
                activeType = blockStack.top().type;
            }

            // Handle new block start
            if (startBlock(line))
            {
                BlockType detectedType = detectType(line);

                BlockEvent startEvent;
                startEvent.kind = EventKind::START;
                startEvent.type = detectType(line);
                startEvent.lineNumber = lineNumber;
                startEvent.indentLevel = indentLevel;
                startEvent.lineText = trimmed;

                events.push_back(startEvent);

                blockStack.push({detectedType, indentLevel}); // Push only tracking information
            }
            else
            {
                BlockEvent lineEvent;
                lineEvent.kind = EventKind::LINE;
                lineEvent.type = BlockType::UNKNOWN;
                lineEvent.lineNumber = lineNumber;
                lineEvent.indentLevel = indentLevel;
                lineEvent.lineText = trimmed;

                events.push_back(lineEvent);
            }
        }

        // Close remaining blocks at EOF(End-Of-File)
        while (!blockStack.empty())
        {
            BlockEvent endEvent;
            endEvent.kind = EventKind::END;
            endEvent.type = blockStack.top().type;
            endEvent.lineNumber = lineNumber;
            endEvent.indentLevel = 0;
            endEvent.lineText = "EOF";

            events.push_back(endEvent);

            blockStack.pop();
        }

        return events;
    }

}

// Returns the type of the block as a string
string blockTypeToString(BlockType type)
{
    switch (type)
    {
    case BlockType::CLASS:
        return "class";
    case BlockType::FUNCTION:
        return "function";
    case BlockType::IF:
        return "if";
    case BlockType::ELIF:
        return "elif";
    case BlockType::ELSE:
        return "else";
    case BlockType::FOR:
        return "for";
    case BlockType::WHILE:
        return "while";
    case BlockType::TRY:
        return "try";
    case BlockType::EXCEPT:
        return "except";
    case BlockType::WITH:
        return "with";
    default:
        return "unknown";
    }
}