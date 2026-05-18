const fetch = require('node-fetch');
const { writeFileSync } = require('fs');

// Get start date from command line argument (format: YYYY-MM-DD)
const startDate = process.argv[2] ? new Date(process.argv[2]) : new Date('1970-01-01');
if (isNaN(startDate.getTime())) {
    console.error('Invalid date format. Please use YYYY-MM-DD');
    process.exit(1);
}

const repoUrl = 'https://gitlab.com/api/v4/projects/Shinobi-Systems%2FShinobi/repository/commits';
const perPage = 100; // Max allowed by GitLab API
let allCommits = [];
let shouldContinueFetching = true;

async function fetchCommitDetails(commitId) {
    try {
        const response = await fetch(`${repoUrl}/${commitId}`);
        const commitDetails = await response.json();
        return commitDetails;
    } catch (error) {
        console.error(`Error fetching details for commit ${commitId}:`, error);
        return null;
    }
}

function parseMultiCommitDescription(description) {
    if (!description) return [];

    // Split the description into individual commit messages
    const commitSections = description.split(/\n\s*-\scommit\s/).filter(section => section.trim() !== '');

    const formattedCommits = [];

    commitSections.forEach(section => {
        if (!section) return;

        // Add back the "commit " prefix we split on
        const lines = [`commit ${section.split('\n')[0]}`, ...section.split('\n').slice(1)];

        const commitInfo = {
            hash: lines[0].replace('commit ', '').trim(),
            details: []
        };

        lines.forEach(line => {
            const trimmedLine = line.replace(/^\s*-\s*/, '').trim();
            if (trimmedLine) {
                commitInfo.details.push(trimmedLine);
            }
        });

        formattedCommits.push(commitInfo);
    });

    return formattedCommits;
}

async function fetchCommits(page = 1) {
    if (!shouldContinueFetching) return;

    try {
        const response = await fetch(`${repoUrl}?ref_name=dev&per_page=${perPage}&page=${page}`);
        const commits = await response.json();

        if (!commits || commits.length === 0) {
            shouldContinueFetching = false;
            return;
        }

        // Process commits
        for (const commit of commits) {
            const commitDate = new Date(commit.created_at);

            if (commitDate >= startDate) {
                // Fetch full commit details including description
                const commitDetails = await fetchCommitDetails(commit.id);
                if (commitDetails && commitDetails.message) {
                    let description = commitDetails.message || '';
                    // Remove the first line (commit title) if it exists in description
                    description = description.split('\n').slice(1).join('\n').trim();

                    // Check if this is a multi-commit description
                    if (description.includes('\n    - commit ')) {
                        const multiCommits = parseMultiCommitDescription(description);
                        allCommits.push({
                            ...commit,
                            isMultiCommit: true,
                            multiCommits: multiCommits
                        });
                    } else {
                        allCommits.push({
                            ...commit,
                            description: description.split('\n').filter(line => line.trim() !== '')
                        });
                    }
                } else {
                    allCommits.push(commit);
                }
            } else {
                // We've reached commits older than our start date
                shouldContinueFetching = false;
                break;
            }
        }

        // If we got a full page and all commits were recent, check next page
        if (shouldContinueFetching && commits.length === perPage) {
            await fetchCommits(page + 1);
        }
    } catch (error) {
        console.error('Error fetching commits:', error);
        shouldContinueFetching = false;
    }
}

function formatChangelog(commits) {
    const changelog = {};

    commits.forEach(commit => {
        const date = new Date(commit.created_at);
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        const day = date.getDate();

        if (!changelog[monthYear]) {
            changelog[monthYear] = {};
        }

        if (!changelog[monthYear][day]) {
            changelog[monthYear][day] = [];
        }

        // Extract author name if not Moe
        let authorNote = '';
        if (commit.author_name && !commit.author_name.includes('Moe')) {
            authorNote = ` (${commit.author_name})`;
        }

        changelog[monthYear][day].push({
            message: commit.title,
            description: commit.description || [],
            isMultiCommit: commit.isMultiCommit || false,
            multiCommits: commit.multiCommits || [],
            author: authorNote,
            date: commit.created_at
        });
    });

    // Generate markdown output
    let output = `### Changelog (${startDate.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]})\n\n`;

    // Sort months newest first
    const sortedMonths = Object.keys(changelog).sort((a, b) => {
        return new Date(b) - new Date(a);
    });

    for (const monthYear of sortedMonths) {
        output += `#### ${monthYear}\n`;

        // Sort days newest first
        const sortedDays = Object.keys(changelog[monthYear]).sort((a, b) => b - a);

        for (const day of sortedDays) {
            const dateObj = new Date(changelog[monthYear][day][0].date);
            const weekday = dateObj.toLocaleString('default', { weekday: 'long' });

            output += `- **${monthYear.split(' ')[0]} ${day} (${weekday})**\n`;

            changelog[monthYear][day].forEach(commit => {
                output += `  - ${commit.message}${commit.author}\n`;

                if (commit.isMultiCommit) {
                    commit.multiCommits.forEach(multiCommit => {
                        output += `    - commit ${multiCommit.hash}\n`;
                        multiCommit.details.forEach((detail, index) => {
                            if (index > 0) { // Skip the hash line we already printed
                                output += `      - ${detail}\n`;
                            }
                        });
                    });
                } else if (commit.description && commit.description.length > 0) {
                    commit.description.forEach(descLine => {
                        output += `    - ${descLine}\n`;
                    });
                }
            });
        }

        output += '\n';
    }

    return output
        .replaceAll('-     ', '  - ')
        .replaceAll('-     + ', '  - ')
        .replaceAll('- - ', '  - ')
        .replaceAll('- + ', '  - ')
        .split('\n').filter(item =>
            !item.includes('- Author: ')
            && !item.includes('- Date: ')
            && !item.includes('- commit ')
        ).join('\n')
        // .replaceAll('- Date:   ', '  - Date: ')
        // .replaceAll('- Author: ', '  - Author: ')
}

async function main() {
    console.log(`Fetching commits since ${startDate.toISOString().split('T')[0]}...`);
    await fetchCommits();

    if (allCommits.length === 0) {
        console.log('No commits found since the specified date.');
        return;
    }

    console.log(`Found ${allCommits.length} commits since ${startDate.toISOString().split('T')[0]}`);

    const changelog = formatChangelog(allCommits);
    const outputFilename = `changelog_${startDate.toISOString().split('T')[0]}_to_${new Date().toISOString().split('T')[0]}.md`;

    writeFileSync(outputFilename, changelog);
    console.log(`Changelog written to ${outputFilename}`);
}

main().catch(console.error);
