import { Component, createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { createStore } from "solid-js/store";
import IMask from 'imask'; // imports all modules
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(utc);
dayjs.extend(customParseFormat);

import { BossModel } from "../@core/models";

interface Boss extends BossModel {
    remaining?: number;
    calculatedKill?: string;
}

export const BossTracker: Component = () => {

    let playingSound: boolean = false;

    let storage: {
        [key: string]: any,
        bosses: Array<Boss>
    } = JSON.parse(localStorage.getItem('dekaron-helper') || '{}');
    if (!storage.bosses) storage.bosses = bosses;

    const [state, setState] = createStore(storage);

    let bossInterval = setInterval(() => {
        state.bosses.forEach((b, i) => updateBossTimer(b, i));
    }, 100);

    let alarmInterval = setInterval(() => {
        let bossSpawning = state.bosses.find(b => b.remaining < 120);
        if (bossSpawning) playAlarm();
    }, 1000 * 60);

    function updateBossTimer(boss: Boss, index: number) {
        if (!boss.lastKill) return;
        let now = dayjs();
        let diff = now.diff(dayjs(boss.lastKill), 'seconds');
        let remaining = boss.respawn * 60 * 60 - diff;
        while (remaining < -300) {
            remaining = remaining + boss.respawn * 60 * 60
        }
        setState('bosses', [index], 'remaining', remaining);
    }

    function markBossSlain(index: number, time: string) {
        if (!time) time = dayjs().format()
        setState('bosses', [index], 'lastKill', time);

        let stateCopy = JSON.parse(JSON.stringify(state));
        stateCopy.bosses.forEach(b => delete b.remaining);
        localStorage.setItem('dekaron-helper', JSON.stringify(stateCopy));
    }

    function playAlarm() {
        if (playingSound) return;
        let audioSource = document.getElementById('alarm');
        if (audioSource instanceof HTMLAudioElement) {
            playingSound = true;
            audioSource.play();
            setTimeout(() => {
                playingSound = false;
            }, 1000 * 60);
        }
    }

    onCleanup(() => {
        clearInterval(bossInterval);
        clearInterval(alarmInterval);
    });

    return (
        <div class="min-h-screen bg-slate-700 text-slate-100 p-10">
            <div class="flex justify-center mb-8">
                <Clock />
            </div>
            <div class="grid grid-cols-2 xl:grid-cols-4 gap-5 text-slate-900">
                <For each={state.bosses}>
                    {(boss: Boss, i) =>
                        <BossCard boss={boss} markBossSlain={(e) => markBossSlain(i(), e)} />
                    }
                </For>
            </div>
        </div>
    )
}

function Clock() {
    const [time, setTime] = createSignal(dayjs().format('HH:mm:ss'));
    const [timeUtc, setTimeUtc] = createSignal(dayjs().utc().format('HH:mm:ss'));

    let interval = setInterval(() => {
        setTime(dayjs().format('HH:mm:ss'));
        setTimeUtc(dayjs().utc().format('HH:mm:ss'));
    }, 100);

    onCleanup(() => clearInterval(interval));

    return (
        <div class="flex flex-col bg-slate-500 text-slate-800 px-4 py-2 rounded-md font-bold">
            <span class="text-2xl text-center">{time()}</span>
            <span class="text-lg text-center">(UTC {timeUtc()})</span>
        </div>
    )
}

function BossCard({ boss, markBossSlain }: { boss: Boss, markBossSlain: Function }) {
    const [pickerOpen, setPickerOpen] = createSignal(false);

    let firstOpen: boolean = false;

    function updateBossTime() {
        let timeInput: string | undefined;
        let inputElement = document.getElementById(boss.name);
        if (inputElement instanceof HTMLInputElement) timeInput = inputElement.value;

        if (!timeInput) {
            alert('Introduce la hora a la que han matado al jefe');
            return;
        }
        try {
            let time = dayjs(timeInput + ':00', 'DD/MM/YYYY HH:mm:ss');
            markBossSlain(time.format());
            setPickerOpen(false);
        } catch {
            alert('Formato de hora invalido');
        }
    }

    function toggleDatePicker() {
        setPickerOpen(!pickerOpen());
        if (pickerOpen()) {
            if (!firstOpen) {
                firstOpen = true;
                var element = document.getElementById(boss.name);

                IMask(element, {
                    mask: '00/00/0000 00:00'
                });
            }
            setTimeout(() => {
                document.getElementById(boss.name)?.focus();
            }, 50);
        }
    }

    return (
        <div class="flex flex-wrap bg-slate-500 p-4 rounded-md shadow-lg">
            <div class="flex w-4/5">
                <span class="py-1"><b class="mr-1">{boss.name}</b>({boss.location})</span>
            </div>
            <div class="flex justify-end w-1/5">
                <span class="bg-slate-700 ml-2 px-3 py-1 rounded-lg text-slate-100 h-fit">{boss.respawn}h</span>
            </div>

            <div class="flex flex-col justify-end w-4/5 mt-3">
                <div 
                class={`flex items-center pb-1 ${boss.remaining < 120 && 'text-green-300'} ${boss.remaining < 3600 && boss.remaining >= 120 && 'text-orange-300'}`}>
                    <Show when={!boss.lastKill}>
                        No recent kills
                    </Show>
                    <Show when={boss.remaining}>
                        <Show when={boss.remaining <= 0}>
                            <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            Might be online
                        </Show>
                        <Show when={boss.remaining > 0}>
                            Respawns in <b class="ml-1">{toHHMMSS(boss.remaining)}</b>
                        </Show>
                    </Show>
                </div>

                <Show when={boss.lastKill}>
                    <span class="mt-1">
                        Last kill <b>{dayjs(boss.lastKill).format('DD/MM/YYYY HH:mm')}</b>
                    </span>
                </Show>
            </div>
            <div class="relative flex justify-end items-end w-1/5 mt-2 text-slate-100">
                <button class=" bg-slate-700 ml-2 px-3 py-1 rounded-lg h-fit" onClick={() => toggleDatePicker()}>
                    <i class="bx bxs-alarm"></i>
                </button>
                <Show when={pickerOpen()}>
                    <div class="z-10 absolute right-0 top-16 flex flex-col bg-slate-600 p-3 rounded-md shadow-lg">
                        <label for="time" class="text-slate-900">dd/mm/yyyy hh:mm</label>
                        <input
                            id={boss.name}
                            type="string"
                            class="bg-slate-700 rounded-md px-3 py-2 shadow-sm focus:outline-none"
                            placeholder={dayjs().format('DD/MM/YYYY HH:mm')}
                            value={dayjs(boss.lastKill).format('DD/MM/YYYY HH:mm')}
                            onKeyDown={(e) => e.key === "Enter" && updateBossTime()} />
                        <div class="flex justify-end">
                            <button class=" bg-slate-700 ml-2 px-3 py-1 rounded-lg mt-2" onClick={() => updateBossTime()}>
                                <i class="bx bx-check"></i>
                            </button>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    )
}

// https://stackoverflow.com/questions/1322732/convert-seconds-to-hh-mm-ss-with-javascript/34841026?r=Saves_UserSavesList#34841026
const toHHMMSS = (secs) => {
    var sec_num = parseInt(secs, 10)
    var hours = Math.floor(sec_num / 3600)
    var minutes = Math.floor(sec_num / 60) % 60
    var seconds = sec_num % 60

    return [hours, minutes, seconds]
        .map(v => v < 10 ? "0" + v : v)
        .filter((v, i) => v !== "00" || i > 0)
        .join(":")
}

const bosses: BossModel[] = [
    {
        name: 'Skeleton King',
        respawn: 8,
        location: 'Ardeca Fortress'
    },
    {
        name: 'Rasputin Lunatic Sorcerer',
        respawn: 8,
        location: 'S. Denev'
    },
    {
        name: 'Lizardman General',
        respawn: 9,
        location: 'S. Denev'
    },
    {
        name: 'Predacious Thunder Bull',
        respawn: 9,
        location: 'N. Denev'
    },
    {
        name: 'Giant Queen Spider',
        respawn: 11,
        location: 'N. Denev'
    },
    {
        name: 'Ungoliant',
        respawn: 7,
        location: 'N. Denev'
    },
    {
        name: 'Arctic Invader',
        respawn: 10,
        location: 'Haihaff'
    },
    {
        name: 'Lufain of Madness',
        respawn: 11,
        location: 'Haihaff'
    },
    {
        name: 'Lizardman Commander',
        respawn: 13,
        location: 'Haihaff'
    },
    {
        name: 'Frizkhan Lord',
        respawn: 11,
        location: 'Haihaff'
    },
    {
        name: 'Ashmahd',
        respawn: 13,
        location: 'Haihaff'
    },
    {
        name: 'Skeleton Commander',
        respawn: 6,
        location: 'Frozen Hills'
    },
    {
        name: 'Sasquatch King',
        respawn: 10,
        location: 'Frozen Hills'
    },
    {
        name: 'Raging Alderamin',
        respawn: 9,
        location: 'Draco Desert'
    },
    {
        name: 'Corrupted Knight Cpt.',
        respawn: 10,
        location: 'Draco Desert'
    },
    {
        name: 'Half Cthulu',
        respawn: 7,
        location: 'Draco Desert'
    },
    {
        name: 'Tyrant Eris',
        respawn: 12,
        location: 'N. Requies'
    },
    {
        name: 'Agathion',
        respawn: 14,
        location: 'S. Requies'
    },
    {
        name: 'Lizardman Adjudicator',
        respawn: 11,
        location: 'Avalon'
    },
    {
        name: 'Furious Queen Spider',
        respawn: 12,
        location: 'Spider Cave'
    },
];